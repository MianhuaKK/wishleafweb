'use strict';

// Local sample data; the UI follows GoalDailyPlanOverlay and does not call AI.
const DAILY_PLAN_BATCHES = [
  [
    { tier: 'seedling', title: 'Read for five minutes', description: 'Settle into your corner with a book. Stop after five minutes.' },
    { tier: 'sapling', title: 'Make your corner inviting', description: 'Clear the chair, put a book nearby, and sit down for a quiet moment.' },
    { tier: 'oak', title: 'Give your reading corner a reset', description: 'Clear the surface, sort your books, and make room for a longer reading break.' },
  ],
  [
    { tier: 'seedling', title: 'Put one thing back', description: 'Choose one item near your chair and return it to its place.' },
    { tier: 'sapling', title: 'Clear a small surface', description: 'Spend ten minutes making a little room on your desk or side table.' },
    { tier: 'oak', title: 'Organise a single shelf', description: 'Take everything off one shelf, choose what belongs, and put it back with care.' },
  ],
  [
    { tier: 'seedling', title: 'Choose a book for later', description: 'Put one book within reach. That can be enough for today.' },
    { tier: 'sapling', title: 'Make room for a quiet break', description: 'Tidy one seat and its nearby surface, then pause there for a few minutes.' },
    { tier: 'oak', title: 'Create a place to unwind', description: 'Arrange the chair, books, and lighting, then enjoy the space you have made.' },
  ],
];
const DAILY_PLAN_TIERS = {
  seedling: { emoji: '🌱', label: 'Easy' },
  sapling: { emoji: '🌿', label: 'Steady' },
  oak: { emoji: '🌳', label: 'Stretch' },
};

class WishLeafDailyPlanDemo extends HTMLElement {
  connectedCallback() {
    this.savedNote = '';
    this.events = new AbortController();
    const options = { signal: this.events.signal };
    this.addEventListener('click', event => this.handleClick(event), options);
    this.addEventListener('input', () => this.renderInputState(), options);
    this.addEventListener('submit', event => this.handleSubmit(event), options);
    this.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      if (!this.querySelector('[data-plan-note-panel]').hidden) this.closeNotes();
      else if (!this.querySelector('[data-plan-feedback-form]').hidden) this.backToPlan();
      else this.close();
    }, options);
    this.querySelector('[data-plan-batches]').addEventListener('scroll', () => this.updateDots(), options);
    this.reset();
  }

  disconnectedCallback() { this.events.abort(); }

  reset() {
    this.close(false);
    this.savedNote = '';
    this.batchCount = 1;
    this.activeBatch = 0;
  }

  open(trigger) {
    this.trigger = trigger;
    this.batchCount = 1;
    this.activeBatch = 0;
    this.querySelector('[data-plan-options]').hidden = false;
    this.querySelector('[data-plan-feedback-form]').hidden = true;
    this.querySelector('[data-plan-refresh-choice]').hidden = true;
    this.querySelector('[data-plan-note-panel]').hidden = true;
    this.querySelector('[data-plan-base]').inert = false;
    this.hidden = false;
    this.closest('wishleaf-progress-demo').querySelector('[data-preview-base]').inert = true;
    this.renderBatches();
    this.querySelector('[data-plan-close]').focus({ preventScroll: true });
    this.announce('Choose an action level. Selecting a suggestion adds a sample task for today; it does not complete it.');
  }

  close(restoreFocus = true) {
    this.hidden = true;
    this.closest('wishleaf-progress-demo').querySelector('[data-preview-base]').inert = false;
    if (restoreFocus) this.trigger?.focus({ preventScroll: true });
  }

  announce(message) {
    this.closest('wishleaf-progress-demo').querySelector('[data-feedback]').textContent = message;
  }

  handleClick(event) {
    if (event.target.matches('[data-plan-note-panel]')) return this.closeNotes();
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.hasAttribute('data-plan-close')) this.close();
    else if (button.hasAttribute('data-plan-select')) this.apply(button);
    else if (button.hasAttribute('data-plan-refresh')) this.showRefreshChoice();
    else if (button.hasAttribute('data-plan-refresh-now')) this.refresh();
    else if (button.hasAttribute('data-plan-feedback')) this.showFeedback();
    else if (button.matches('[data-plan-back], [data-plan-collapse]')) this.backToPlan();
    else if (button.hasAttribute('data-plan-notes')) this.openNotes();
    else if (button.hasAttribute('data-plan-note-cancel')) this.closeNotes();
    else if (button.hasAttribute('data-plan-page')) this.goToBatch(Number(button.dataset.planPage));
  }

  apply(button) {
    const suggestion = DAILY_PLAN_BATCHES[Number(button.dataset.batch)][Number(button.dataset.planSelect)];
    if (!suggestion || this.hidden) return;
    this.close();
    this.dispatchEvent(new CustomEvent('wishleaf-plan-selected', { bubbles: true, detail: suggestion }));
  }

  renderBatches() {
    this.querySelector('[data-plan-batches]').innerHTML = DAILY_PLAN_BATCHES.slice(0, this.batchCount).map((batch, batchIndex) =>
      `<div class="wlp-plan-batch" role="group" aria-label="Suggestion batch ${batchIndex + 1}">${batch.map((item, index) => {
        const tier = DAILY_PLAN_TIERS[item.tier];
        return `<button type="button" class="wlp-plan-card" data-tier="${item.tier}" data-batch="${batchIndex}" data-plan-select="${index}" aria-label="${tier.label}: ${item.title}"><span class="wlp-tier"><span aria-hidden="true">${tier.emoji}</span>${tier.label}</span><strong>${item.title}</strong><span class="wlp-plan-description">${item.description}</span></button>`;
      }).join('')}</div>`
    ).join('');
    const dots = this.querySelector('[data-plan-dots]');
    dots.hidden = this.batchCount < 2;
    dots.innerHTML = Array.from({ length: this.batchCount }, (_, i) => `<button type="button" data-plan-page="${i}" aria-label="Show suggestion batch ${i + 1}" aria-pressed="${i === this.activeBatch}"></button>`).join('');
    this.querySelector('[data-plan-remaining]').textContent = `Refresh · ${DAILY_PLAN_BATCHES.length - this.batchCount} left`;
    this.querySelector('[data-plan-refresh]').hidden = this.batchCount === DAILY_PLAN_BATCHES.length;
    this.querySelector('[data-plan-exhausted]').hidden = this.batchCount < DAILY_PLAN_BATCHES.length;
    this.goToBatch(this.activeBatch);
  }

  goToBatch(index) {
    this.activeBatch = index;
    const pages = this.querySelector('[data-plan-batches]');
    pages.scrollLeft = pages.clientWidth * index;
    this.updateDots();
  }

  updateDots() {
    const pages = this.querySelector('[data-plan-batches]');
    if (!pages.clientWidth) return;
    this.activeBatch = Math.round(pages.scrollLeft / pages.clientWidth);
    this.querySelectorAll('[data-plan-page]').forEach(button => {
      button.setAttribute('aria-pressed', String(Number(button.dataset.planPage) === this.activeBatch));
    });
  }

  showRefreshChoice() {
    this.querySelector('[data-plan-refresh]').hidden = true;
    this.querySelector('[data-plan-refresh-choice]').hidden = false;
    this.querySelector('[data-plan-refresh-now]').focus({ preventScroll: true });
  }

  backToPlan() {
    this.querySelector('[data-plan-options]').hidden = false;
    this.querySelector('[data-plan-feedback-form]').hidden = true;
    this.querySelector('[data-plan-refresh-choice]').hidden = true;
    this.querySelector('[data-plan-refresh]').hidden = this.batchCount === DAILY_PLAN_BATCHES.length;
    this.goToBatch(this.activeBatch);
    this.querySelector(this.batchCount < DAILY_PLAN_BATCHES.length ? '[data-plan-refresh]' : '[data-plan-close]').focus({ preventScroll: true });
  }

  refresh() {
    if (this.batchCount >= DAILY_PLAN_BATCHES.length) return;
    this.batchCount += 1;
    this.backToPlan();
    this.activeBatch = this.batchCount - 1;
    this.renderBatches();
    this.querySelector(`[data-batch="${this.activeBatch}"]`).focus({ preventScroll: true });
    this.announce('Another sample batch is ready. You can swipe back to earlier suggestions. The live app generates plans from your goal and preferences.');
  }

  showFeedback() {
    this.querySelector('[data-plan-options]').hidden = true;
    this.querySelector('[data-plan-feedback-form]').hidden = false;
    this.querySelector('[data-plan-request]').value = '';
    this.querySelector('[data-plan-preference]').checked = false;
    this.querySelector('[data-plan-note-error]').hidden = true;
    this.renderInputState();
    this.querySelector('[data-plan-request]').focus({ preventScroll: true });
  }

  openNotes() {
    this.querySelector('[data-plan-note-input]').value = this.savedNote;
    this.querySelector('[data-plan-note-panel]').hidden = false;
    this.querySelector('[data-plan-base]').inert = true;
    this.renderInputState();
    this.querySelector('[data-plan-note-input]').focus({ preventScroll: true });
  }

  closeNotes() {
    this.querySelector('[data-plan-note-panel]').hidden = true;
    this.querySelector('[data-plan-base]').inert = false;
    this.querySelector('[data-plan-notes]').focus({ preventScroll: true });
  }

  renderInputState() {
    this.querySelector('[data-plan-feedback-submit]').disabled = !this.querySelector('[data-plan-request]').value.trim();
    this.querySelector('[data-plan-note-count]').textContent = `${this.querySelector('[data-plan-note-input]').value.length}/1000`;
  }

  handleSubmit(event) {
    event.preventDefault();
    if (event.target.matches('[data-plan-note-form]')) {
      this.savedNote = this.querySelector('[data-plan-note-input]').value;
      this.closeNotes();
      this.announce('Personal notes saved for this preview only.');
      return;
    }
    if (!event.target.matches('[data-plan-feedback-form]')) return;
    const request = this.querySelector('[data-plan-request]').value.trim();
    if (!request) return;
    if (this.querySelector('[data-plan-preference]').checked) {
      const note = [this.savedNote.trim(), request].filter(Boolean).join('\n');
      if (note.length > 1000) {
        this.querySelector('[data-plan-note-error]').hidden = false;
        return;
      }
      this.savedNote = note;
    }
    this.refresh();
    this.announce('Showing another sample batch. In the app, AI uses your request to generate new suggestions; this preview does not send it anywhere.');
  }
}

customElements.define('wishleaf-daily-plan-demo', WishLeafDailyPlanDemo);
