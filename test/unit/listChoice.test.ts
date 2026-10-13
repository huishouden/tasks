import { describe, expect, it } from 'vitest';
import { listChoice } from '../../src/lib/listChoice';

const ids = ['chores', 'projects'];

describe('listChoice', () => {
  it('before the lists load: the address, else the remembered list, written into the address', () => {
    expect(listChoice('projects', 'chores', null)).toEqual({ shown: 'projects', save: null, address: null });
    expect(listChoice(null, 'chores', null)).toEqual({ shown: 'chores', save: null, address: 'chores' });
  });

  it('a list the household has wins and is remembered', () => {
    expect(listChoice('projects', 'chores', ids)).toEqual({ shown: 'projects', save: 'projects', address: null });
    expect(listChoice('chores', 'chores', ids)).toEqual({ shown: 'chores', save: null, address: null });
  });

  it('a stale or foreign id is corrected in the address and never remembered', () => {
    // The sample's list after signing in to a household without it.
    expect(listChoice('weekend', 'projects', ids)).toEqual({ shown: 'projects', save: null, address: 'projects' });
    expect(listChoice('gone', 'gone-too', ids)).toEqual({ shown: 'chores', save: null, address: 'chores' });
  });

  it('a list just created is kept while its snapshot is on the way, and remembered once it arrives', () => {
    expect(listChoice('new1', 'chores', ids, 'new1')).toEqual({ shown: 'new1', save: null, address: null });
    expect(listChoice('new1', 'chores', [...ids, 'new1'], 'new1')).toEqual({ shown: 'new1', save: 'new1', address: null });
  });

  it('a household with no lists leaves the address alone', () => {
    expect(listChoice(null, 'chores', [])).toEqual({ shown: 'chores', save: null, address: null });
  });
});
