import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CharacterSelectionPanel } from '../CharacterSelectionPanel';
import type { ThemeCharacterSummary } from '@/features/lobby/api';

const baseCharacter: ThemeCharacterSummary = {
  id: 'character-detective',
  name: '탐정',
  description: '사건의 진실을 좇는 손님',
  image_url: null,
  image_media_id: null,
  sort_order: 1,
};

function renderPanel(characters: ThemeCharacterSummary[]) {
  return render(
    <CharacterSelectionPanel
      characters={characters}
      selectedCharacterId={null}
      selectedByOtherPlayerIds={new Set()}
      onSelect={vi.fn()}
    />
  );
}

afterEach(() => {
  cleanup();
});

describe('CharacterSelectionPanel', () => {
  it('renders a character portrait image when image_url is available', () => {
    const portraitUrl = 'https://cdn.example.test/characters/detective.webp';
    const { container } = renderPanel([{ ...baseCharacter, image_url: portraitUrl }]);

    const portrait = container.querySelector('img');

    expect(screen.getByRole('button', { name: /탐정/ })).toBeInTheDocument();
    expect(portrait).toBeInTheDocument();
    expect(portrait).toHaveAttribute('src', portraitUrl);
  });

  it('keeps the fallback icon when image_url is missing even if image_media_id exists', () => {
    const { container } = renderPanel([
      { ...baseCharacter, image_url: null, image_media_id: 'media-detective' },
    ]);

    const characterButton = screen.getByRole('button', { name: /탐정/ });

    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(characterButton.querySelector('svg[aria-hidden="true"]')).toBeInTheDocument();
  });
});
