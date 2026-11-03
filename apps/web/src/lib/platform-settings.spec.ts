import { describe, expect, it } from 'vitest';
import { editableSettings } from './platform-settings';

describe('optional community privacy notice setting', () => {
  it('includes both explicit on and explicit off in admin updates', () => {
    expect(editableSettings({ privacyNoticeEnabled: true })).toEqual({ privacyNoticeEnabled: true });
    expect(editableSettings({ privacyNoticeEnabled: false })).toEqual({ privacyNoticeEnabled: false });
  });

  it('does not accidentally send a privacy setting when editing unrelated fields', () => {
    expect(editableSettings({ platformName: 'Learning' })).toEqual({ platformName: 'Learning' });
  });

  it('never sends read-only database metadata to settings API', () => {
    expect(editableSettings({ id: 'default', privacyNoticeEnabled: false })).toEqual({ privacyNoticeEnabled: false });
  });
});
