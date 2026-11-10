// A scripted preview of goalChat.tsx. It never sends messages or creates real tasks.
class WishLeafCoachDemo extends HTMLElement {
  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;
    this.messages = this.querySelector('[data-coach-messages]');
    this.initialMessages = this.messages.innerHTML;
    this.composer = this.querySelector('[data-coach-input]');
    this.sendButton = this.querySelector('[data-coach-send]');
    this.followUp = this.querySelector('[data-coach-follow-up]');
    this.feedback = this.querySelector('[data-coach-feedback]');
    this.querySelector('[data-coach-reset]').disabled = false;
    this.enableDrafts();
    this.followUp.disabled = false;
    this.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button || button.disabled) return;
      if (button.hasAttribute('data-coach-add')) this.confirmTask(button);
      if (button.hasAttribute('data-coach-follow-up')) this.prepareFollowUp();
      if (button.hasAttribute('data-coach-reset')) this.reset();
    });
    this.querySelector('form').addEventListener('submit', (event) => {
      event.preventDefault();
      this.sendFollowUp();
    });
  }

  enableDrafts() {
    this.querySelectorAll('[data-coach-add]').forEach((button) => { button.disabled = false; });
  }

  confirmTask(button) {
    const card = button.closest('[data-coach-task]');
    if (card.classList.contains('is-confirmed')) return;
    const title = card.querySelector('h3');
    const status = document.createElement('p');
    status.className = 'wlc-task-status';
    status.textContent = '✓ Task created';
    const number = document.createElement('p');
    number.className = 'wlc-task-number';
    number.textContent = `No. DEMO-${card.dataset.coachTask}`;
    card.replaceChildren(status, title, number);
    card.classList.add('is-confirmed');
    card.tabIndex = -1;
    card.focus({ preventScroll: true });
    this.feedback.textContent = `“${title.textContent}” added in this preview. Other suggestions stay as drafts.`;
  }

  prepareFollowUp() {
    if (this.followUpSent) return;
    this.composer.value = 'Could we make the first step smaller?';
    this.composer.classList.add('has-message');
    this.sendButton.disabled = false;
    this.feedback.textContent = 'The sample message is ready. Press Send to see the conversation continue.';
    this.sendButton.focus({ preventScroll: true });
    this.sendButton.scrollIntoView({ behavior: 'auto', block: 'nearest' });
  }

  sendFollowUp() {
    if (this.followUpSent || !this.composer.value) return;
    this.followUpSent = true;
    const fragment = this.querySelector('template').content.cloneNode(true);
    const newMessage = fragment.querySelector('.wlc-row-user');
    this.messages.append(fragment);
    this.enableDrafts();
    this.composer.value = '';
    this.composer.classList.remove('has-message');
    this.sendButton.disabled = true;
    this.followUp.disabled = true;
    // Keep the new exchange visible without moving the surrounding page.
    this.messages.scrollTop += newMessage.getBoundingClientRect().top - this.messages.getBoundingClientRect().top - 8;
    this.messages.focus({ preventScroll: true });
    this.feedback.textContent = 'A smaller step is ready to review. Choose Add task if it fits. This is a scripted sample reply.';
  }

  reset() {
    this.messages.innerHTML = this.initialMessages;
    this.enableDrafts();
    this.messages.scrollTop = 0;
    this.followUpSent = false;
    this.composer.value = '';
    this.composer.classList.remove('has-message');
    this.sendButton.disabled = true;
    this.followUp.disabled = false;
    this.feedback.textContent = 'Scroll through the conversation. Try Add task on a draft, or choose the follow-up below.';
  }
}

customElements.define('wishleaf-coach-demo', WishLeafCoachDemo);
