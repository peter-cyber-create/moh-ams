import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PasswordInput from '../components/PasswordInput.jsx';

describe('PasswordInput', () => {
  it('renders hidden password by default with icon-only show control', () => {
    const html = renderToStaticMarkup(
      createElement(PasswordInput, {
        label: 'Password',
        value: 'secret123',
        onChange: () => {},
      }),
    );
    expect(html).toContain('type="password"');
    expect(html).toContain('Show password');
    expect(html).toContain('secret123');
    expect(html).not.toContain('>Show<');
    expect(html).not.toContain('>Hide<');
  });
});
