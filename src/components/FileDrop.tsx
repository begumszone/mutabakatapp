import { useRef, useState } from 'react';
import type { Locale } from '../types';
import { translate } from '../lib/i18n';

interface Props {
  locale: Locale;
  fileName: string | null;
  onFile: (file: File) => void;
  onClear: () => void;
}

/** The upload target for one side's statement. */
export function FileDrop({ locale, fileName, onFile, onClear }: Props) {
  const t = (key: string) => translate(locale, key);
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  if (fileName) {
    return (
      <div className="file-chip">
        <span aria-hidden="true">📄</span>
        <span className="name">{fileName}</span>
        <span className="spacer" />
        <button className="ghost small" onClick={onClear} type="button">
          ✕
        </button>
      </div>
    );
  }

  return (
    <div
      className={over ? 'drop over' : 'drop'}
      onClick={() => input.current?.click()}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        const file = event.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') input.current?.click();
      }}
      role="button"
      tabIndex={0}
    >
      <div className="title">{t('upload.drop')}</div>
      <div className="faint">{t('upload.formats')}</div>
      <input
        ref={input}
        type="file"
        accept=".xlsx,.xlsm,.csv,.tsv,.txt"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = '';
        }}
      />
    </div>
  );
}
