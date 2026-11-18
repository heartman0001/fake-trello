'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  /** Optional dot color, e.g. a board label color. */
  color?: string;
}

interface SelectProps {
  id?: string;
  name?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Custom listbox select — replaces the native <select> so the menu styling is
 * ours, not the browser's.
 */
export default function Select({
  id,
  name,
  value,
  options,
  onChange,
  placeholder = 'Select…',
  className = '',
  disabled = false,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listboxId = useId();
  const optionIdPrefix = useId();

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const open = (startIndex?: number) => {
    if (disabled) return;
    setActiveIndex(
      startIndex ??
        (selectedIndex >= 0 ? selectedIndex : options.length > 0 ? 0 : -1),
    );
    setIsOpen(true);
  };

  const close = (refocus = false) => {
    setIsOpen(false);
    setActiveIndex(-1);
    if (refocus) buttonRef.current?.focus();
  };

  const commit = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    close(true);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        if (!isOpen) {
          open();
          return;
        }
        if (options.length === 0) return;
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        setActiveIndex((current) => {
          const from = current < 0 ? (delta === 1 ? -1 : 0) : current;
          return (from + delta + options.length) % options.length;
        });
        return;
      }
      case 'Home':
        if (!isOpen) return;
        event.preventDefault();
        setActiveIndex(0);
        return;
      case 'End':
        if (!isOpen) return;
        event.preventDefault();
        setActiveIndex(options.length - 1);
        return;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (!isOpen) {
          open();
          return;
        }
        commit(activeIndex);
        return;
      case 'Escape':
        if (!isOpen) return;
        event.preventDefault();
        // Don't let an enclosing dialog/panel close on the same keypress.
        event.stopPropagation();
        close(true);
        return;
      case 'Tab':
        if (isOpen) close();
        return;
      default:
        return;
    }
  };

  const renderOptionContent = (
    option: SelectOption,
    isSelected: boolean,
    isActive: boolean,
  ) => (
    <>
      <span className="flex min-w-0 items-center gap-2">
        {option.color && (
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: option.color }}
            aria-hidden="true"
          />
        )}
        <span
          className={`truncate ${
            isSelected ? 'font-medium text-gray-900' : 'text-gray-700'
          }`}
        >
          {option.label}
        </span>
      </span>
      {(isSelected || isActive) && (
        <Check
          className={`h-4 w-4 shrink-0 ${
            isSelected ? 'text-blue-600' : 'text-transparent'
          }`}
          aria-hidden="true"
        />
      )}
    </>
  );

  const activeOptionId =
    isOpen && activeIndex >= 0
      ? `${optionIdPrefix}-option-${activeIndex}`
      : undefined;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        id={id}
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-activedescendant={activeOptionId}
        disabled={disabled}
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={handleKeyDown}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-gray-300 bg-white px-2 py-2 text-left text-sm text-gray-900 transition-colors hover:bg-gray-50 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected?.color && (
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: selected.color }}
              aria-hidden="true"
            />
          )}
          <span className={`truncate ${selected ? '' : 'text-gray-500'}`}>
            {selected ? selected.label : placeholder}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-gray-200 bg-white p-1 shadow-lg">
          <ul
            id={listboxId}
            role="listbox"
            aria-labelledby={id}
            className="max-h-60 overflow-y-auto"
          >
            {options.length === 0 && (
              <li className="px-2 py-1.5 text-sm text-gray-500">
                No options
              </li>
            )}
            {options.map((option, index) => {
              const isSelected = option.value === value;
              const isActive = index === activeIndex;

              return (
                <li
                  key={option.value}
                  id={`${optionIdPrefix}-option-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => commit(index)}
                  className={`flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 text-sm ${
                    isActive ? 'bg-blue-50' : ''
                  }`}
                >
                  {renderOptionContent(option, isSelected, isActive)}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
