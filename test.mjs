import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

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
  console.log('Успех: заглавие, език, мобилна настройка, 9 теми и връзка към програмата.');
} catch (error) {
  console.error(`Тестът не премина: ${error.message}`);
  process.exitCode = 1;
}
