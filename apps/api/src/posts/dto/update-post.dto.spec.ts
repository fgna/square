import { describe, it, expect } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdatePostDto } from './update-post.dto';

// PUT /posts/:id used to take a bare { content: string } with no validation,
// so an edit could empty a post or exceed the length a new post may have.
describe('UpdatePostDto', () => {
  const check = (body: object) => validate(plainToInstance(UpdatePostDto, body));

  it('accepts ordinary text', async () => {
    expect(await check({ content: 'Corrected a typo' })).toHaveLength(0);
  });

  it('rejects an empty edit', async () => {
    expect(await check({ content: '' })).not.toHaveLength(0);
  });

  it('rejects text longer than a new post may be', async () => {
    expect(await check({ content: 'x'.repeat(10001) })).not.toHaveLength(0);
  });

  it('rejects a missing or non-string content', async () => {
    expect(await check({})).not.toHaveLength(0);
    expect(await check({ content: 42 })).not.toHaveLength(0);
  });
});
