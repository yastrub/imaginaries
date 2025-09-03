import { useState, useCallback } from 'react';

export function useJewelryType(setPrompt) {
  const [selectedJewelryType, setSelectedJewelryType] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');

  const selectJewelryType = useCallback((type, label) => {
    // If selecting the same type, clear it
    if (type === selectedJewelryType) {
      setSelectedJewelryType('');
      setSelectedLabel('');
      // Clear the prompt
      if (setPrompt) {
        setPrompt('');
      }
    } else {
      // Set the new type and label
      setSelectedJewelryType(type);
      setSelectedLabel(label);
      // Override the prompt with the capitalized label
      if (setPrompt) {
        setPrompt(label);
      }
    }
  }, [selectedJewelryType, setPrompt]);

  const clearJewelryType = useCallback(() => {
    setSelectedJewelryType('');
    setSelectedLabel('');
  }, []);

  return {
    selectedJewelryType,
    selectedLabel,
    selectJewelryType,
    clearJewelryType
  };
}
