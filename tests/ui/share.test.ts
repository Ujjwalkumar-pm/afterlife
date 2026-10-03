// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as badges from '../../src/ui/badges';

const b = { id: 'rooftop', name: 'Rooftop', stars: 2 as const, date: '2026-10-03' };
const nav = navigator as unknown as Record<string, unknown>;
afterEach(() => {
  delete nav.share;
  delete nav.canShare;
  vi.restoreAllMocks();
});

describe('shareBadge', () => {
  const png = () => vi.spyOn(badges.internals, 'png').mockResolvedValue(new Blob(['x'], { type: 'image/png' }));
  it('opens the share sheet with the image and text when files can be shared', async () => {
    png();
    const share = vi.fn().mockResolvedValue(undefined);
    nav.canShare = () => true;
    nav.share = share;
    expect(await badges.shareBadge(b, { touch: true })).toBe('shared');
    expect(share.mock.calls[0]![0].text).toBe(badges.shareText('Rooftop', 2));
    expect(share.mock.calls[0]![0].files[0].name).toBe('afterlife-rooftop-badge.png');
  });
  it('a cancelled sheet (AbortError) or a sheet already open (InvalidStateError) does nothing', async () => {
    png();
    nav.canShare = () => true;
    for (const name of ['AbortError', 'InvalidStateError']) {
      nav.share = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name }));
      const click = vi.spyOn(HTMLAnchorElement.prototype, 'click');
      expect(await badges.shareBadge(b, { touch: true })).toBe('cancelled');
      expect(click).not.toHaveBeenCalled();
    }
  });
  it('downloads the image where files cannot be shared', async () => {
    png();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    expect(await badges.shareBadge(b)).toBe('saved');
    expect(click).toHaveBeenCalledTimes(1);
  });
  it('on a computer (fine pointer) it downloads even if the browser could share', async () => {
    png();
    nav.canShare = () => true;
    const share = vi.fn();
    nav.share = share;
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    expect(await badges.shareBadge(b, { touch: false })).toBe('saved');
    expect(share).not.toHaveBeenCalled();
    expect(click).toHaveBeenCalledTimes(1);
  });
});
