import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

export interface AutocompleteOption {
  id: string;
  label: string;
  secondary?: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: AutocompleteOption[];
  onSelect?: (option: AutocompleteOption) => void;
  placeholder?: string;
  inputClassName?: string;
  maxResults?: number;
  disabled?: boolean;
  showSearchIcon?: boolean;
}

const normalizar = (valor: string) => valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export const AutocompleteDropdown: React.FC<Props> = ({
  value,
  onChange,
  options,
  onSelect,
  placeholder,
  inputClassName = '',
  maxResults = 8,
  disabled = false,
  showSearchIcon = false,
}) => {
  const [aberto, setAberto] = useState(false);
  const [indiceAtivo, setIndiceAtivo] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);

  const filtradas = useMemo(() => {
    const termo = normalizar(value);
    if (!termo) return options.slice(0, maxResults);
    return options.filter((item) => normalizar(`${item.label} ${item.secondary || ''}`).includes(termo)).slice(0, maxResults);
  }, [value, options, maxResults]);

  useEffect(() => {
    const fechar = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, []);

  useEffect(() => setIndiceAtivo(-1), [value]);

  const selecionar = (item: AutocompleteOption) => {
    onChange(item.label);
    onSelect?.(item);
    setAberto(false);
    setIndiceAtivo(-1);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setAberto(true);
      setIndiceAtivo((atual) => Math.min(atual + 1, filtradas.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setIndiceAtivo((atual) => Math.max(atual - 1, 0));
    } else if (event.key === 'Enter' && aberto && indiceAtivo >= 0 && filtradas[indiceAtivo]) {
      event.preventDefault();
      selecionar(filtradas[indiceAtivo]);
    } else if (event.key === 'Escape') {
      setAberto(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      {showSearchIcon && <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 z-10" />}
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => { onChange(e.target.value); setAberto(true); }}
        onFocus={() => setAberto(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className={`${showSearchIcon ? 'pl-8' : ''} ${value ? 'pr-9' : ''} ${inputClassName}`}
      />
      {value && !disabled && (
        <button type="button" onClick={() => { onChange(''); setAberto(true); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700" aria-label="Limpar">
          <X className="w-4 h-4" />
        </button>
      )}
      {aberto && filtradas.length > 0 && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl max-h-72 overflow-y-auto">
          {filtradas.map((item, index) => (
            <button
              type="button"
              key={item.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selecionar(item)}
              className={`w-full px-3.5 py-2.5 text-left border-b border-slate-100 last:border-0 ${index === indiceAtivo ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
            >
              <div className="font-semibold text-sm text-slate-900 truncate">{item.label}</div>
              {item.secondary && <div className="text-xs text-slate-500 mt-0.5 truncate">{item.secondary}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
