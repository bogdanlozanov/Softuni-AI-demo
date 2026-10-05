import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';

const expectedTopics = [
  'Ресурси', 'Инженерство на запитванията',
  'ChatGPT за лични и служебни задачи', 'ChatGPT за обучение и проучвания',
  'Custom GPTs, Projects и персонализация',
  'Agent Mode, инструменти и OpenAI Playground',
  'Codex за продуктивност и подготовка за изпит', 'Редовен изпит', 'Поправителен изпит',
];
const text = (value) => value.replace(/<[^>]*>/g, '').trim();

try {
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  assert.match(html, /<!doctype html>/i, 'Липсва HTML doctype.');
  assert.match(html, /<html\b[^>]*lang="bg"/i, 'Езикът трябва да бъде български.');
  assert.match(html, /<meta\b[^>]*name="viewport"[^>]*content="width=device-width,\s*initial-scale=1"/i, 'Липсва мобилна viewport настройка.');
  const headings = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
  assert.equal(headings.length, 1, 'Очаква се едно основно заглавие.');
  assert.equal(text(headings[0][1]), 'ChatGPT Essentials', 'Неправилно заглавие на курса.');
  const topics = [...html.matchAll(/<article\b[^>]*data-topic="(\d+)"[^>]*>([\s\S]*?)<\/article>/g)];
  assert.equal(topics.length, 9, 'Очакват се точно девет теми.');
  topics.forEach(([, number, content], index) => {
    assert.equal(Number(number), index + 1, 'Темите трябва да са последователни.');
    assert.equal(text(content.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/)?.[1] ?? ''), expectedTopics[index], `Неправилно заглавие за тема ${number}.`);
    assert.ok(text(content.match(/<p\b[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? '').length > 0, `Липсва описание за тема ${number}.`);
  });
  const button = html.match(/<a\b[^>]*class="button"[^>]*href="#([^"\s]+)"[^>]*>([\s\S]*?)<\/a>/);
  assert.ok(button, 'Липсва бутон с вътрешна връзка.');
  assert.ok(text(button[2]).startsWith('Разгледай темите'), 'Неправилен текст на бутона.');
  assert.ok(html.includes(`id="${button[1]}"`), 'Бутонът води към несъществуваща секция.');
  assert.doesNotMatch(html, /<(?:script|link|iframe)\b[^>]*(?:src|href)\s*=/i, 'Страницата трябва да е без външни зависимости.');
  const formMarkup = html.match(/<form\b[^>]*id="inquiry-form"[^>]*>([\s\S]*?)<\/form>/)?.[1];
  assert.ok(formMarkup, 'Липсва формата за запитване.');
  const inputTags = [...formMarkup.matchAll(/<input\b[^>]*>/g)].map(([tag]) => tag);
  assert.equal(inputTags.length, 3, 'Формата трябва да съдържа точно три полета.');

  // Execute the actual inline script against a small DOM adapter, using only Node built-ins.
  // This exercises event handling and visible error/success state, not a copy of validation code.
  const elements = new Map();
  let focused = null;
  for (const [, tag, attrs, id] of html.matchAll(/<(input|form|button|p)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
    const attributes = Object.fromEntries([...attrs.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
    const element = new EventTarget();
    Object.assign(element, {
      value: '', textContent: '', hidden: /\bhidden\b/.test(attrs), disabled: false,
      validity: { typeMismatch: false }, attributes,
      setAttribute(key, value) { this.attributes[key] = value; },
      focus() { focused = id; },
    });
    elements.set(id, element);
  }
  for (const name of ['name', 'email', 'phone']) {
    const input = elements.get('inquiry-' + name);
    assert.ok(input, `Липсва поле ${name}.`);
    assert.match(formMarkup, new RegExp(`<label\\b[^>]*for="inquiry-${name}"`), 'Липсва свързан етикет.');
    assert.ok(inputTags.find((tag) => tag.includes(`id="inquiry-${name}"`) && /\brequired\b/.test(tag)), 'Полето трябва да е задължително.');
    for (const id of input.attributes['aria-describedby'].split(' ')) assert.ok(elements.has(id), 'Невалидна връзка към помощен текст.');
    assert.equal(elements.get(name + '-error').hidden, true, 'Грешките трябва първоначално да са скрити.');
  }
  assert.equal(elements.get('inquiry-email').attributes.type, 'email');
  assert.equal(elements.get('inquiry-phone').attributes.type, 'tel');
  const form = elements.get('inquiry-form');
  const success = elements.get('inquiry-success');
  const submitButton = elements.get('inquiry-submit');
  assert.equal(submitButton.attributes.type, 'submit');
  assert.equal(success.attributes.role, 'status');
  assert.equal(success.hidden, true);
  assert.match(html, /\.success\s*\{[^}]*background:\s*#123c28/, 'Успехът трябва да е със зелен фон.');
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1);
  runInNewContext(scripts[0][1], {
    document: { getElementById: (id) => elements.get(id) },
  }, { timeout: 1000 });
  assert.equal(form.noValidate, true);
  function setField(name, value) {
    const input = elements.get('inquiry-' + name);
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }
  function submitForm() {
    const event = new Event('submit', { cancelable: true });
    form.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true, 'Изпращането не трябва да презарежда страницата.');
  }
  function expectError(name, expected) {
    assert.equal(elements.get('inquiry-' + name).attributes['aria-invalid'], String(expected));
    const error = elements.get(name + '-error');
    assert.equal(error.hidden, !expected);
    assert.equal(Boolean(error.textContent), expected);
  }
  function expectValidSubmission() {
    submitForm();
    for (const name of ['name', 'email', 'phone']) expectError(name, false);
    assert.equal(success.hidden, false);
    assert.match(success.textContent, /Успех!/);
    assert.match(success.textContent, /демонстрация/);
    assert.equal(submitButton.disabled, true, 'Успехът трябва да предотвратява повторно изпращане без промяна.');
  }
  submitForm();
  for (const name of ['name', 'email', 'phone']) expectError(name, true);
  assert.equal(focused, 'inquiry-name', 'Фокусът трябва да е върху първото грешно поле.');
  assert.equal(success.hidden, true);
  setField('name', 'Иван Петров');
  setField('email', 'ivan@example.com');
  setField('phone', '0888 123 456');
  expectValidSubmission();

  for (const value of [' ', 'И'.repeat(101), '🙂'.repeat(101)]) {
    setField('name', value);
    submitForm();
    expectError('name', true);
    assert.equal(success.hidden, true);
    assert.equal(focused, 'inquiry-name');
  }
  for (const value of ['И'.repeat(100), '🙂'.repeat(100), '  Иван Петров  ', "Anne-Marie O’Connor"]) {
    setField('name', value);
    expectValidSubmission();
  }
  setField('name', 'Иван Петров');
  for (const value of [' ', 'ivan', 'ivan@', '@example.com', 'ivan@example', 'ivan@@example.com', 'ivan@.com', 'ivan@example..com', 'iv an@example.com']) {
    setField('email', value);
    submitForm();
    expectError('email', true);
    assert.equal(focused, 'inquiry-email');
    assert.equal(success.hidden, true);
  }
  for (const value of ['ivan@example.com', '  ivan+course@example.co.uk  ']) {
    setField('email', value);
    expectValidSubmission();
  }
  // Native email validation can reject additional malformed addresses.
  elements.get('inquiry-email').validity.typeMismatch = true;
  submitForm();
  expectError('email', true);
  assert.equal(success.hidden, true);
  elements.get('inquiry-email').validity.typeMismatch = false;
  setField('email', 'ivan@example.com');

  const validPhones = [
    '0878123456', '0888123456', '0899123456', '0988123456', '0999123456',
    '+359 888 123 456', '00359-888-123-456', ' 0888 123 456 ', '(0888) 123-456',
    '02 123 4567', '032 123 456', '+359 52 123 456', '00359 82 123 456',
    '0431 12345', '0701 12345',
  ];
  for (const value of validPhones) {
    setField('phone', value);
    expectValidSubmission();
  }
  const invalidPhones = [
    '', ' ', '112', '0000000000', '088812345', '08881234567', '888123456',
    '+44 888 123 456', '+359 0888 123 456', '00359 0888 123 456',
    '0888abc123456', '+359+888123456', '0888/123456', '359888123456',
    '0123456789', '085123456', '090123456', '048123456', '043012345', '02 123 456',
  ];
  for (const value of invalidPhones) {
    setField('phone', value);
    submitForm();
    expectError('phone', true);
    assert.equal(success.hidden, true, `Невалиден телефон е приет: ${value}`);
    assert.equal(submitButton.disabled, false);
    assert.equal(focused, 'inquiry-phone');
  }
  setField('phone', '0888123456');
  expectError('phone', false); // Correcting input clears the previous error immediately.
  expectValidSubmission();
  setField('name', 'Мария');
  assert.equal(success.hidden, true, 'Промяната трябва да изчиства предишния успех.');
  assert.equal(success.textContent, '');
  assert.equal(submitButton.disabled, false);
  elements.get('inquiry-name').value = '';
  elements.get('inquiry-name').dispatchEvent(new Event('blur'));
  expectError('name', true);
  setField('name', 'Мария');
  expectValidSubmission();
  console.log(`Успех: сайтът, трите полета, задължителни стойности, граница 100 символа, имейли, ${validPhones.length + invalidPhones.length} телефонни сценария, error state, фокус и локален успех.`);
} catch (error) {
  console.error(`Тестът не премина: ${error.message}`);
  process.exitCode = 1;
}
