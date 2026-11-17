(() => {
  'use strict';
  const signup = document.querySelector('.early-access-form');
  const localPreview = document.documentElement.dataset.preview === 'true' ||
    location.protocol === 'file:' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (signup && localPreview) {
    signup.addEventListener('submit', event => {
      event.preventDefault();
      const status = signup.querySelector('.form-status');
      status.hidden = false;
      status.textContent = 'Preview only. Nothing was sent or saved. Signup will be available on wovon.ai.';
    });
  }

  const explorer = document.querySelector('.weave-explorer');
  const example = document.getElementById('example');
  const evidence = document.getElementById('example-evidence');
  const versions = [...document.querySelectorAll('[data-version]')];
  const order = ['learn', 'build', 'use', 'change'];
  const stopStory = () => window.WovonWeave?.pause();
  const selectView = view => {
    if (!window.WovonWeave) throw new Error('Animation is unavailable; read the explanation in the page.');
    return window.WovonWeave.selectView(view);
  };
  document.documentElement.classList.add('js-ready');
  function selectVersion(version) {
    if (!['original', 'updated'].includes(version)) throw new Error('Choose original or updated.');
    versions.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.version === version)));
    document.getElementById('response-original').hidden = version !== 'original';
    document.getElementById('response-updated').hidden = version !== 'updated';
    example.dataset.version = version;
    return {
      version,
      illustrative: true,
      response: document.getElementById(`response-${version}`).innerText.trim(),
      evidence: [...evidence.querySelectorAll('li')].map(li => ({id: li.id, text: li.innerText.trim()}))
    };
  }
  selectVersion('original');
  versions.forEach(button => button.addEventListener('click', () => selectVersion(button.dataset.version)));
  document.querySelectorAll('[data-open-example]').forEach(link => link.addEventListener('click', () => { example.open = true; }));
  document.querySelectorAll('[data-open-evidence]').forEach(link => link.addEventListener('click', () => { example.open = true; evidence.open = true; }));
  document.querySelectorAll('[data-source]').forEach(link => link.addEventListener('click', () => { evidence.open = true; }));
  function openFragment() {
    const id = location.hash.slice(1);
    if (id === 'example' || id === 'example-evidence' || id.startsWith('source-')) example.open = true;
    if (id === 'example-evidence' || id.startsWith('source-')) evidence.open = true;
  }
  openFragment();
  window.addEventListener('hashchange', openFragment);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopStory(); });

  // Browser tools operate the same local controls as the reader. They do not
  // query a Wovon instance, send a message, or claim the illustrative data is real.
  const registry = document.modelContext;
  if (typeof registry?.registerTool === 'function') {
    const lifecycle = new AbortController();
    const result = value => ({content: [{type: 'text', text: JSON.stringify(value)}]});
    const register = tool => {
      try {
        Promise.resolve(registry.registerTool(tool, {signal: lifecycle.signal}))
          .catch(error => console.warn('Wovon browser tool unavailable:', error.message));
      } catch (error) { console.warn('Wovon browser tool unavailable:', error.message); }
    };
    register({
      name: 'show_learning_view',
      title: 'Explore the Wovon weave',
      description: 'Select a view of this website’s conceptual weave illustration. Changes only the local illustration and caption; does not access a knowledge model or send data.',
      inputSchema: {type: 'object', properties: {view: {type: 'string', enum: order, description: 'Which aspect of the learning story to show.'}}, required: ['view'], additionalProperties: false},
      async execute(input) {
        if (!input || typeof input !== 'object' || Object.keys(input).some(key => key !== 'view')) throw new Error('Expected only a view.');
        stopStory();
        const state = selectView(input.view);
        explorer.querySelector('.weave-stage').scrollIntoView({behavior: 'instant', block: 'center'});
        return result(state);
      }
    });
    register({
      name: 'select_knowledge_topic',
      title: 'Explore overlapping knowledge pathways',
      description: 'Select an illustrative business topic in the Wovon animation. Rearranges intact woven blocks and their connections to show a different grouping for the question. Local presentation only; no product query or transmission.',
      inputSchema: {type:'object', properties:{topic:{type:'string', enum:['customers','operations','risk']}}, required:['topic'], additionalProperties:false},
      async execute(input) {
        if (!input || typeof input !== 'object' || Object.keys(input).some(key => key !== 'topic')) throw new Error('Expected only a topic.');
        if (!window.WovonWeave) throw new Error('Animation is unavailable.');
        const state = window.WovonWeave.selectTopic(input.topic);
        explorer.querySelector('.weave-stage').scrollIntoView({behavior:'instant', block:'center'});
        return result(state);
      }
    });
    register({
      name: 'inspect_illustrative_response',
      title: 'Inspect the example response and evidence',
      description: 'Open the website’s clearly labelled fictional procurement example, choose earlier or updated evidence, and reveal its source records. Local presentation only; this is not a live Wovon query and sends no data.',
      inputSchema: {type: 'object', properties: {version: {type: 'string', enum: ['original', 'updated'], description: 'Whether to show the earlier response or the response after the supplier notice.'}}, required: ['version'], additionalProperties: false},
      async execute(input) {
        if (!input || typeof input !== 'object' || Object.keys(input).some(key => key !== 'version')) throw new Error('Expected only a version.');
        if (!['original', 'updated'].includes(input.version)) throw new Error('Choose original or updated.');
        example.open = true;
        evidence.open = true;
        const state = selectVersion(input.version);
        example.scrollIntoView({behavior: 'instant', block: 'start'});
        return result(state);
      }
    });
    window.addEventListener('pagehide', () => lifecycle.abort(), {once: true});
  }
})();
