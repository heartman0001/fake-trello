import { useState } from 'react';

interface AddColumnFormProps {
  onAddColumn: (title: string) => void;
  onCancel: () => void;
}

export default function AddColumnForm({ 
  onAddColumn,
  onCancel 
}: AddColumnFormProps) {
  const [title, setTitle] = useState('');

  const handleAdd = () => {
    if (title.trim()) {
      onAddColumn(title.trim());
      setTitle('');
    }
  };

  return (
    <div className="w-80 shrink-0 bg-white rounded-md shadow-sm border border-gray-200 p-4 animate-in fade-in slide-in-from-bottom-2">
      <h3 className="text-sm font-medium text-gray-900 mb-3">Add Column</h3>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleAdd();
          if (e.key === 'Escape') onCancel();
        }}
        placeholder="Enter column title..."
        autoFocus
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
      />
      <div className="flex justify-end gap-2 mt-3">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
        >
          Cancel
        </button>
        <button
          onClick={handleAdd}
          disabled={!title.trim()}
          className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Add Column
        </button>
      </div>
    </div>
  );
}
