import React from 'react';
import { usePromptContext } from '../contexts/PromptContext';

export const JewelryTypeBadges = React.memo(() => {
  const { jewelryTypes, selectedJewelryType, selectJewelryType } = usePromptContext();
  
  return (
    <div className="flex flex-wrap justify-center gap-3 mb-10">
      {jewelryTypes.map((type) => {
        const isSelected = selectedJewelryType === type.id;
        return (
          <button
            key={type.id}
            type="button"
            onClick={() => selectJewelryType(type.id, type.label)}
            className={`preset-button px-6 py-3 ${isSelected ? 'selected' : ''}`}
          >
            <span className="text-sm font-medium text-white">
              {type.label}
            </span>
          </button>
        );
      })}
    </div>
  );
});
