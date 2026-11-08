'use strict';

const STARTING_STRATEGIES = [
  { title: 'Pair it with a song', detail: 'Play a favourite song while gathering clothes.' },
  { title: 'Change the setting', detail: 'Put a bag and laundry basket within reach.' },
  { title: 'Start with a visible corner', detail: "Choose one spot you'd like to use today." },
];
const BREAKDOWN_OPTIONS = [
  { title: 'By activity', detail: 'One kind of work at a time.', steps: ['Collect the rubbish', 'Gather loose clothes', 'Make the bed', 'Clear the desk'] },
  { title: 'By time', detail: 'A short block, with a stopping point.', steps: ['Collect rubbish for 2 minutes', 'Gather clothes for 3 minutes', 'Pause and decide whether to continue'] },
];
const ADJUSTMENT_OPTIONS = [
  { title: 'Just do the clothes', detail: 'Put away your clothes. Leave the rest for another day.' },
  { title: 'Clear the desk only', detail: 'Make one useful surface available today.' },
];
const HELP_MODES = {
  suggest: { label: 'Ways to start', icon: 'suggestion', options: STARTING_STRATEGIES },
  breakdown: { label: 'Choose how to break it down', icon: 'decompose', options: BREAKDOWN_OPTIONS },
  adjust: { label: 'Adjust', icon: 'failure_adjustment', options: ADJUSTMENT_OPTIONS },
};

function choiceMarkup(option, index, mode) {
  const steps = option.steps ? `<span class="wlt-creates">Creates ${option.steps.length} subtasks</span><span class="wlt-step-chips">${option.steps.map((step, stepIndex) => `<span><b>${stepIndex + 1}</b>${step}</span>`).join('')}</span>` : '';
  return `<button type="button" class="wld-choice" data-choice="${index}"><span class="wlt-choice-body"><span class="wlt-choice-heading"><span class="wlt-choice-icon"><img src="../../images/features/wishleaf_icon_${HELP_MODES[mode].icon}.svg" alt="" width="15" height="15"></span><strong>${option.title}</strong></span><small>${option.detail}</small>${steps}</span></button>`;
}

function announceDemo(name, detail) {
  document.dispatchEvent(new CustomEvent(name, { detail }));
}

class WishLeafActionDemo extends HTMLElement {
  connectedCallback() {
    this.mode = 'suggest';
    this.date = 21;
    this.task = this.initialTask();
    this.rows = [...this.querySelectorAll('[data-demo-row]')];
    this.events = new AbortController();
    const options = { signal: this.events.signal };
    this.addEventListener('click', event => this.handleClick(event), options);
    this.addEventListener('change', event => {
      if (event.target.matches('[data-sort]')) this.renderSort();
    }, options);
    this.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      if (!this.querySelector('[data-proposal]').hidden) this.closeProposal();
      else this.closeTaskMenu(true);
    }, options);
    this.dismissTaskMenu = event => {
      if (!event.target.closest('#task-helpers, [data-open-task]')) this.closeTaskMenu();
    };
    document.addEventListener('pointerdown', this.dismissTaskMenu, options);
    this.addEventListener('focusout', event => {
      if (event.relatedTarget && !event.relatedTarget.closest('#task-helpers, [data-open-task]')) this.closeTaskMenu();
    }, options);
    this.renderTask();
  }

  disconnectedCallback() {
    this.events.abort();
  }

  initialTask() {
    return { title: 'Tidy up my room', detail: '', steps: [], done: false, adopted: false };
  }

  handleClick(event) {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.hasAttribute('data-reset')) this.reset();
    else if (button.hasAttribute('data-close-proposal')) this.closeProposal();
    else if (button.hasAttribute('data-open-task')) this.toggleTaskActions();
    else if (button.hasAttribute('data-date')) this.selectDate(Number(button.dataset.date));
    else if (button.dataset.help) this.selectHelp(button.dataset.help);
    else if (button.hasAttribute('data-choice')) this.applyProposal(Number(button.dataset.choice));
    else if (button.hasAttribute('data-complete')) this.completeTask();
    else if (button.hasAttribute('data-sample-check')) {
      button.setAttribute('aria-pressed', String(button.getAttribute('aria-pressed') !== 'true'));
      this.renderSort();
      button.focus({ preventScroll: true });
    }
    else if (button.hasAttribute('data-subtask')) this.completeSubtask(Number(button.dataset.subtask));
  }

  selectHelp(mode) {
    this.mode = mode;
    this.closeTaskMenu();
    this.renderProposal();
    this.querySelector('[data-proposal]').hidden = false;
    this.querySelector('[data-today-base]').inert = true;
    this.querySelector('.wlt-app').scrollIntoView({ block: 'start', behavior: 'instant' });
    this.querySelector('[data-close-proposal]').focus({ preventScroll: true });
    this.querySelector('[data-feedback]').textContent = 'Review the proposal. Your task stays unchanged until you apply it.';
  }

  closeProposal() {
    if (this.querySelector('[data-proposal]').hidden) return;
    this.querySelector('[data-proposal]').hidden = true;
    this.querySelector('[data-today-base]').inert = false;
    this.querySelector('[data-open-task]').focus({ preventScroll: true });
  }

  toggleTaskActions() {
    const actions = this.querySelector('[data-task-actions]');
    if (!actions.hidden) return this.closeTaskMenu(true);
    const trigger = this.querySelector('[data-open-task]');
    const frame = this.querySelector('.wlt-app').getBoundingClientRect();
    actions.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    const row = trigger.getBoundingClientRect();
    const below = row.bottom - frame.top + 6;
    const above = row.top - frame.top - actions.offsetHeight - 6;
    actions.style.top = (below + actions.offsetHeight < frame.height - 8 ? below : Math.max(8, above)) + 'px';
    actions.querySelector('button').focus({ preventScroll: true });
  }

  closeTaskMenu(restoreFocus = false) {
    const actions = this.querySelector('[data-task-actions]');
    if (actions.hidden) return;
    actions.hidden = true;
    const trigger = this.querySelector('[data-open-task]');
    trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) trigger.focus({ preventScroll: true });
  }

  selectDate(day) {
    this.date = day;
    this.closeTaskMenu();
    this.renderDate();
    this.querySelector('[data-feedback]').textContent = day === 21 ? 'Tap “Tidy up my room” to open its task menu.' : 'The sample tasks are on October 21.';
    this.querySelector(`[data-dates] [data-date="${day}"]`).focus({ preventScroll: true });
  }

  renderDate() {
    const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    this.querySelector('[data-dates]').innerHTML = weekdays.map((label, index) => {
      const day = 19 + index;
      return `<button type="button" data-date="${day}" aria-pressed="${day === this.date}" aria-label="${label}, October ${day}${day === 21 ? ', Today' : ''}"><span>${label}</span><b>${day}</b></button>`;
    }).join('');
    this.querySelector('[data-task-list]').hidden = this.date !== 21;
    this.querySelector('[data-empty]').hidden = this.date === 21;
    this.renderCount();
  }

  renderCount() {
    const pending = this.rows.filter(row => row.querySelector('.wld-check').getAttribute('aria-pressed') === 'false').length;
    this.querySelector('[data-task-count]').textContent = this.date === 21 ? pending + ' to complete' : '';
  }

  renderSort() {
    const sort = this.querySelector('[data-sort]').value;
    const list = this.querySelector('[data-task-list]');
    const groups = new Map();
    for (const row of this.rows) {
      const done = row.querySelector('.wld-check').getAttribute('aria-pressed') === 'true';
      row.classList.toggle('is-done', done);
      const label = done ? 'completed' : sort === 'default' ? 'upcoming' : row.dataset[sort];
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(row);
    }
    const orders = { time: ['Morning', 'Afternoon', 'Evening'], difficulty: ['Light', 'Medium'] };
    const groupOrder = orders[sort] || [...groups.keys()];
    const sections = [...groupOrder.filter(key => key !== 'completed'), 'completed'].filter(key => groups.has(key)).map(label => {
      const section = document.createElement('section');
      const heading = document.createElement('h4');
      heading.textContent = label;
      section.append(heading, ...groups.get(label));
      return section;
    });
    list.replaceChildren(...sections);
    this.renderCount();
  }

  renderProposal() {
    const config = HELP_MODES[this.mode];
    this.querySelector('[data-panel-label]').textContent = config.label;
    this.querySelector('[data-panel-title]').textContent = this.task.title;
    this.querySelector('[data-choices]').innerHTML = config.options.map((option, index) => choiceMarkup(option, index, this.mode)).join('');
    this.querySelector('[data-proposal]').dataset.kind = this.mode;
  }

  applyProposal(index) {
    const option = HELP_MODES[this.mode].options[index];
    if (!option) return;
    const title = this.mode === 'adjust' ? option.title : this.task.title;
    const addingSteps = this.mode === 'breakdown';
    const detail = addingSteps ? `${option.steps.length} subtasks · ${option.title.toLowerCase()}` : option.detail;
    const steps = addingSteps
      ? option.steps.map(text => this.task.steps.find(step => step.text === text) || { text, done: false })
      : this.task.steps;
    this.task = { title, detail, steps, done: false, adopted: true };
    this.renderTask();
    this.closeProposal();
    this.querySelector('[data-feedback]').textContent = this.mode === 'breakdown' ? 'Subtasks added. Try checking one off above.' : 'Your choice is now part of the task. Try checking it off.';
    this.querySelector('[data-complete]').focus({ preventScroll: true });
  }

  renderTask() {
    this.querySelector('[data-task-title]').textContent = this.task.title;
    this.querySelector('[data-task-detail]').textContent = this.task.detail;
    this.querySelector('[data-task-detail]').hidden = !this.task.detail;
    this.querySelector('[data-open-task]').disabled = this.task.done;
    const complete = this.querySelector('[data-complete]');
    complete.setAttribute('aria-pressed', String(this.task.done));
    complete.setAttribute('aria-label', this.task.done ? 'Reopen the demo task' : 'Mark the demo task complete');
    const subtasks = this.querySelector('[data-subtasks]');
    subtasks.hidden = this.task.steps.length === 0;
    subtasks.innerHTML = this.task.steps.map((step, index) => `<button type="button" data-subtask="${index}" aria-pressed="${step.done}" class="wld-subtask"><span class="wld-mini-check" aria-hidden="true">${step.done ? '✓' : ''}</span>${step.text}</button>`).join('');
    this.renderSort();
    this.renderDate();
    announceDemo('wishleaf-task-demo-change', this.task);
  }

  completeTask() {
    this.task.done = !this.task.done;
    this.task.steps.forEach(step => { step.done = this.task.done; });
    this.renderTask();
    this.querySelector('[data-complete]').focus({ preventScroll: true });
    this.querySelector('[data-feedback]').textContent = this.task.done ? 'Task completed. Your chosen way of doing it stays with the record.' : 'Task reopened. You can try another approach.';
  }

  completeSubtask(index) {
    this.task.steps[index].done = !this.task.steps[index].done;
    this.task.done = this.task.steps.every(step => step.done);
    this.renderTask();
    const count = this.task.steps.filter(step => step.done).length;
    this.querySelector('[data-feedback]').textContent = `${count} of ${this.task.steps.length} subtasks completed. Each step has its own record.`;
    this.querySelector(`[data-subtask="${index}"]`).focus({ preventScroll: true });
  }

  reset() {
    this.closeProposal();
    this.closeTaskMenu();
    this.mode = 'suggest';
    this.date = 21;
    this.task = this.initialTask();
    this.querySelector('[data-sort]').value = 'default';
    for (const row of this.rows) {
      const check = row.querySelector('[data-sample-check]');
      if (check) check.setAttribute('aria-pressed', String(row.dataset.time === 'Morning'));
    }
    this.renderTask();
    this.querySelector('[data-feedback]').textContent = 'Tap “Tidy up my room” to open its task menu.';
  }
}

class WishLeafTaskResult extends HTMLElement {
  connectedCallback() {
    this.onChange = event => this.render(event.detail);
    document.addEventListener('wishleaf-task-demo-change', this.onChange);
  }

  disconnectedCallback() {
    document.removeEventListener('wishleaf-task-demo-change', this.onChange);
  }

  render(task) {
    this.querySelector('[data-result-title]').textContent = task.title;
    this.querySelector('[data-result-detail]').textContent = task.detail;
    this.querySelector('[data-result-mark]').textContent = task.done ? '✓' : '○';
    this.querySelector('[data-result-subtasks]').innerHTML = task.steps.length ? `<ul class="wld-result-subtasks">${task.steps.map(step => `<li>${step.done ? '✓' : '○'} ${step.text}</li>`).join('')}</ul>` : '';
    this.querySelector('[data-result-status]').textContent = task.done ? 'Completed. The task and its details are kept in the record.' : !task.adopted ? 'The task stays as it is until you apply a proposal.' : task.steps.length ? 'The selected breakdown is now part of the task.' : 'This is the task after your latest choice in the demo.';
  }
}

const INITIAL_HISTORY = [
  { day: 20, text: 'Tidied the reading corner.' },
  { day: 17, text: 'Put books within reach.' },
  { day: 12, text: 'Made space for a reading chair.' },
  { day: 10, text: 'Organised the desk cables.' },
  { day: 7, text: 'Cleared one shelf.' },
  { day: 4, text: 'Gathered loose items.' },
  { day: 3, text: 'Put away a basket of clothes.' },
  { day: 1, text: 'Cleared the desk.' },
];
const BASE_DAY = 20;
const RETURN_DAY = 27;
const NEXT_ACTION = 'Read in my corner for five minutes.';
let goalSnapshot = { day: BASE_DAY, linked: true, completed: false, records: [...INITIAL_HISTORY] };

// The native map uses a vertical route, gold task stars and separate node details.
const MAP_STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/></svg>';
const MAP_TROPHY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3h8v6a4 4 0 0 1-8 0Zm0 2H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 1v5m-4 3h8m-6-3h4"/></svg>';

function renderGoalMap(host, records) {
  const height = 450 + records.length * 90;
  const startY = height - 80;
  const points = [{ x: 29, y: 70 }, { x: 70, y: 210 }];
  const actions = records.map((record, index) => {
    const y = 330 + index * 90;
    const t = (y - 210) / (startY - 210);
    const x = 70 - 40 * (1 - Math.cos(Math.PI * t)) / 2;
    points.push({ x, y });
    return `<button type="button" class="wlp-node wlp-node-task" data-action-index="${index}" style="left:${x}%;top:${y}px" aria-label="October ${record.day}: ${record.text}"><span class="wlp-node-icon">${MAP_STAR}</span><time datetime="2026-10-${String(record.day).padStart(2, '0')}">Oct ${record.day}</time></button>`;
  }).join('');
  points.push({ x: 30, y: startY });
  const path = points.map((point, index) => {
    if (!index) return `M ${point.x * 4} ${point.y}`;
    const previous = points[index - 1];
    const middle = (previous.y + point.y) / 2;
    return `C ${previous.x * 4} ${middle}, ${point.x * 4} ${middle}, ${point.x * 4} ${point.y}`;
  }).join(' ');
  const canvas = host.querySelector('[data-map-canvas]');
  canvas.style.height = `${height}px`;
  canvas.innerHTML = `<svg class="wlp-map-path" viewBox="0 0 400 ${height}" preserveAspectRatio="none" aria-hidden="true"><path d="${path}"/></svg>
    <button type="button" class="wlp-node wlp-node-finish" style="left:29%;top:70px" data-milestone="finish" aria-label="View goal destination"><span class="wlp-node-icon">${MAP_TROPHY}</span><span class="wlp-node-label">Make room for a calmer home</span></button>
    <button type="button" class="wlp-node wlp-node-current" style="left:70%;top:210px" data-milestone="current" aria-label="View current milestone"><img src="../../images/features/map-crown.svg" alt=""><span class="wlp-node-label">Create a comfortable corner</span></button>
    ${actions}
    <span class="wlp-node wlp-node-start" style="left:30%;top:${startY}px" role="img" aria-label="Goal created on October 1"><span class="wlp-node-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/></svg></span><time datetime="2026-10-01">Oct 1</time></span>`;
}

function openGoalDetail(host, trigger, records) {
  let title, copy, date;
  if (trigger.hasAttribute('data-action-index')) {
    const record = records[Number(trigger.dataset.actionIndex)];
    if (!record) return;
    title = record.text.replace(/\.$/, '');
    copy = 'Make room for a calmer home';
    date = `Completed on October ${record.day}, 2026`;
  } else if (trigger.hasAttribute('data-range')) {
    title = 'Journey so far';
    copy = 'From goal creation to the most recent activity.';
    date = `October 1 – October ${Math.max(...records.map(record => record.day))}, 2026`;
  } else if (trigger.dataset.milestone === 'current') {
    title = 'Create a comfortable corner';
    copy = 'Make a small space where you can sit, read, and feel at ease.';
    date = 'In progress';
  } else {
    title = 'Make room for a calmer home';
    copy = 'A home with room for the things you enjoy. Build it one small action at a time.';
    date = 'Goal destination';
  }
  host.detailTrigger = trigger;
  host.querySelector('[data-detail-title]').textContent = title;
  host.querySelector('[data-detail-copy]').textContent = copy;
  host.querySelector('[data-detail-date]').textContent = date;
  host.querySelector('[data-detail]').hidden = false;
  host.querySelector('[data-preview-base]').inert = true;
  host.querySelector('[data-close-detail]').focus({ preventScroll: true });
}

function closeGoalDetail(host, restoreFocus = true) {
  if (host.querySelector('[data-detail]').hidden) return;
  host.querySelector('[data-detail]').hidden = true;
  host.querySelector('[data-preview-base]').inert = false;
  if (restoreFocus && host.detailTrigger?.isConnected) host.detailTrigger.focus({ preventScroll: true });
}

function handleGoalDetail(host, event, records) {
  const trigger = event.target.closest('button');
  if (event.target.matches('[data-detail]') || trigger?.hasAttribute('data-close-detail')) {
    closeGoalDetail(host);
    return true;
  }
  if (trigger?.matches('[data-action-index], [data-milestone], [data-range]')) {
    openGoalDetail(host, trigger, records);
    return true;
  }
  return false;
}

class WishLeafProgressDemo extends HTMLElement {
  connectedCallback() {
    this.view = 'goals';
    this.state = { day: BASE_DAY, linked: true, completed: false, records: [...INITIAL_HISTORY] };
    this.events = new AbortController();
    this.addEventListener('click', event => this.handleClick(event), { signal: this.events.signal });
    this.addEventListener('wishleaf-plan-selected', event => this.applyPlan(event.detail), { signal: this.events.signal });
    this.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeGoalDetail(this);
    }, { signal: this.events.signal });
    this.render();
  }

  disconnectedCallback() { this.events.abort(); }

  handleClick(event) {
    if (handleGoalDetail(this, event, this.state.records)) return;
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.hasAttribute('data-reset')) this.reset();
    else if (button.hasAttribute('data-open-plan')) this.querySelector('wishleaf-daily-plan-demo').open(button);
    else if (button.dataset.view) this.selectView(button.dataset.view);
    else if (button.hasAttribute('data-link')) this.toggleLink();
    else if (button.hasAttribute('data-return')) this.returnLater();
    else if (button.hasAttribute('data-record')) this.recordAction();
  }

  selectView(view) {
    this.view = view;
    this.render();
    const target = this.querySelector(`[data-screen="${view}"] button`);
    target?.focus({ preventScroll: true });
    if (view === 'map') {
      this.querySelector('[data-map-scroll]').scrollTop = 60;
      this.feedback('Tap a gold star to open its action record. Scroll down to revisit earlier steps.');
    } else if (view === 'goals') {
      this.feedback('Tap the green goal card to explore its map, or open Today’s plan.');
    }
  }

  applyPlan(suggestion) {
    this.state.actionTitle = suggestion.title;
    this.state.completed = false;
    this.state.linked = true;
    this.render();
    this.feedback(`“${suggestion.title}” added to today's sample tasks. The goal still has ${this.state.records.length} completed actions. Open the demo controls below to complete it.`);
  }

  toggleLink() {
    this.state.linked = !this.state.linked;
    this.render();
    this.feedback(this.state.linked ? 'This action is linked. Completing it will add to this goal.' : 'This is a standalone task. Completing it will be kept in your day, outside this goal.');
  }

  returnLater() {
    this.state.day = RETURN_DAY;
    this.render();
    this.feedback("It's October 27. The earlier 8 actions remain. The date span still ends at your last goal activity: October 20.");
  }

  recordAction() {
    if (this.state.completed) return;
    this.state.completed = true;
    if (this.state.linked) {
      this.state.records.unshift({ day: this.state.day, text: this.state.actionTitle || NEXT_ACTION });
      this.view = 'map';
    }
    this.render();
    if (this.state.linked) {
      this.querySelector('[data-map-scroll]').scrollTop = 60;
      this.querySelector('[data-action-index="0"]').focus({ preventScroll: true });
    }
    this.feedback(this.state.linked ? `Action recorded. ${this.state.records.length} contributions, with a new gold star on October ${this.state.day}.` : 'Saved to your day. This standalone task leaves the goal at 8 actions.');
  }

  feedback(message) { this.querySelector('[data-feedback]').textContent = message; }

  render() {
    closeGoalDetail(this, false);
    const lastActivity = Math.max(...this.state.records.map(record => record.day));
    this.querySelector('[data-days]').textContent = String(lastActivity);
    this.querySelector('[data-actions]').textContent = String(this.state.records.length);
    this.querySelectorAll('[data-screen]').forEach(screen => { screen.hidden = screen.dataset.screen !== this.view; });
    renderGoalMap(this, this.state.records);
    const link = this.querySelector('[data-link]');
    link.setAttribute('aria-pressed', String(this.state.linked));
    link.textContent = this.state.linked ? '↗ Linked to this goal' : '○ Standalone task';
    link.disabled = this.state.completed;
    this.querySelector('[data-sample-action-title]').textContent = this.state.actionTitle || NEXT_ACTION;
    this.querySelectorAll('[data-record]').forEach(record => {
      record.disabled = this.state.completed;
      record.textContent = this.state.completed ? 'Action recorded ✓' : 'Complete this action ✓';
    });
    const later = this.querySelector('[data-return]');
    later.disabled = this.state.day === RETURN_DAY || this.state.completed;
    later.textContent = this.state.day === RETURN_DAY ? 'Back on October 27 · same history' : 'Try returning after a week →';
    this.querySelector('.wld-next-action').classList.toggle('is-done', this.state.completed);
    goalSnapshot = this.state;
    announceDemo('wishleaf-goal-demo-change', this.state);
  }

  reset() {
    this.querySelector('wishleaf-daily-plan-demo').reset();
    this.state = { day: BASE_DAY, linked: true, completed: false, records: [...INITIAL_HISTORY] };
    this.view = 'goals';
    this.render();
    this.querySelector('[data-map-scroll]').scrollTop = 60;
    this.feedback('Demo reset. Tap the green goal card to explore, or try a new action.');
  }
}

class WishLeafHistoryDemo extends HTMLElement {
  connectedCallback() {
    this.events = new AbortController();
    const options = { signal: this.events.signal };
    document.addEventListener('wishleaf-goal-demo-change', event => this.render(event.detail), options);
    this.addEventListener('click', event => handleGoalDetail(this, event, this.state.records), options);
    this.addEventListener('keydown', event => { if (event.key === 'Escape') closeGoalDetail(this); }, options);
    this.render(goalSnapshot);
    this.querySelector('[data-map-scroll]').scrollTop = 60;
  }

  disconnectedCallback() { this.events.abort(); }

  render(state) {
    this.state = state;
    closeGoalDetail(this, false);
    this.querySelector('[data-history-count]').textContent = `${state.records.length} actions`;
    renderGoalMap(this, state.records);
    this.querySelector('[data-history-note]').textContent = state.completed
      ? state.linked ? 'Your new action is the latest gold star. Tap it to see the record; earlier steps remain below.' : 'The standalone task is in your day; this goal history stays unchanged.'
      : 'Tap a star to open its action record. Scroll down to see earlier steps.';
  }
}

class WishLeafReflectionDemo extends HTMLElement {
  connectedCallback() {
    this.onChange = event => this.render(event.detail);
    document.addEventListener('wishleaf-goal-demo-change', this.onChange);
    this.events = new AbortController();
    this.querySelector('[data-show-records]').addEventListener('click', () => this.toggleRecords(), { signal: this.events.signal });
    this.querySelector('[data-reflection-theme]').addEventListener('click', () => {
      const dark = this.querySelector('.wlp-poster').classList.toggle('is-dark');
      const button = this.querySelector('[data-reflection-theme]');
      button.setAttribute('aria-pressed', String(dark));
      button.setAttribute('aria-label', dark ? 'Use light reflection theme' : 'Use dark reflection theme');
      button.textContent = dark ? 'Light ☀' : 'Dark ☾';
    }, { signal: this.events.signal });
    this.render(goalSnapshot);
  }

  disconnectedCallback() {
    document.removeEventListener('wishleaf-goal-demo-change', this.onChange);
    this.events.abort();
  }

  toggleRecords() {
    const button = this.querySelector('[data-show-records]');
    const show = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(show));
    this.querySelector('[data-reflection-records]').hidden = !show;
  }

  render(state) {
    const updated = state.completed;
    const date = updated ? state.day : BASE_DAY;
    this.querySelector('[data-reflection-date]').textContent = `${date}/10`;
    this.querySelector('[data-reflection-title]').textContent = updated ? 'You made use of the space you created.' : 'A little room for yourself.';
    this.querySelector('[data-reflection-copy]').textContent = updated ? 'Five minutes in your reading corner. Today adds an experience of its own, alongside the work that made this space possible.' : 'You tidied your reading corner, took a walk, and made a little space to pause. A few ordinary actions, kept together.';
    if (updated && state.actionTitle) {
      this.querySelector('[data-reflection-title]').textContent = 'A small action, a little more space.';
      this.querySelector('[data-reflection-copy]').textContent = `Today's action: ${state.actionTitle}. One more ordinary moment, kept alongside the work that came before it.`;
    }
    this.querySelector('[data-reflection-goal]').textContent = updated && !state.linked ? '0 wishes nurtured today' : '1 wish nurtured today';
    this.querySelector('[data-reflection-goal-name]').textContent = updated && !state.linked ? 'Recorded without a goal association' : 'Make room for a calmer home';
    this.querySelector('[data-reflection-energy]').innerHTML = updated
      ? '<p>[ 100% 🌱 Home &amp; wellbeing ]<span>A little care for yourself and your space.</span></p>'
      : '<p>[ 60% 🌱 Home &amp; focus ]<span>A little care for the space around you.</span></p><p>[ 30% 🌙 Body &amp; mind ]<span>A walk outside, a moment to breathe.</span></p><p>[ 10% 🌀 Recovery ]<span>Time to pause and put the day into words.</span></p>';
    this.querySelector('[data-reflection-signal]').textContent = updated
      ? 'The space you made has become a place to pause. A small, enjoyable moment can be worth returning to.'
      : 'A comfortable corner can be an invitation. You made a little space today; tomorrow, you can enjoy being in it.';
    this.querySelector('[data-reflection-gains]').textContent = updated ? `💧 +1   ☀️ +0   🌱 +${state.linked ? 1 : 0}` : '💧 +1   ☀️ +2   🌱 +1';
    const records = updated ? [state.actionTitle || NEXT_ACTION] : ['Tidied the reading corner.', 'Took a walk outside.', 'Wrote a short note about the day.'];
    this.querySelector('[data-reflection-records]').innerHTML = records.map(record => `<li>${record}</li>`).join('');
  }
}

customElements.define('wishleaf-task-result', WishLeafTaskResult);
customElements.define('wishleaf-history-demo', WishLeafHistoryDemo);
customElements.define('wishleaf-reflection-demo', WishLeafReflectionDemo);
customElements.define('wishleaf-action-demo', WishLeafActionDemo);
customElements.define('wishleaf-progress-demo', WishLeafProgressDemo);
