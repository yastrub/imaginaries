import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { presets } from '../config/presets';

// Create the context
const PromptContext = createContext();

// Define jewelry types
const JEWELRY_TYPES = [
  { id: 'ring', label: 'Ring' },
  { id: 'necklace', label: 'Necklace' },
  { id: 'bracelet', label: 'Bracelet' },
  { id: 'earrings', label: 'Earrings' },
  { id: 'pendant', label: 'Pendant' },
  { id: 'watch', label: 'Watch' }
];

// Create the provider component
export function PromptProvider({ children }) {
  // Create a ref to store the context value
  const contextRef = React.useRef(null);
  
  // Make the context ref globally accessible
  if (typeof window !== 'undefined') {
    window.PROMPT_CONTEXT_REF = contextRef;
  }
  // Initialize from the first jewelry type to avoid post-mount race
  const FIRST = JEWELRY_TYPES[0] || { id: '', label: '' };
  // State for prompt
  const [prompt, setPrompt] = useState(FIRST.label);
  
  // State for jewelry type
  const [selectedJewelryType, setSelectedJewelryType] = useState(FIRST.id);
  const [selectedLabel, setSelectedLabel] = useState(FIRST.label);
  
  // State for presets
  const [selectedPresets, setSelectedPresets] = useState([]);
  // IMPORTANT: Initialize modal as closed
  const [isPresetsModalOpen, setIsPresetsModalOpen] = useState(false);
  
  // Memoized jewelry types
  const jewelryTypes = useMemo(() => JEWELRY_TYPES, []);
  
  // Handle prompt change with auto type selection (no formatting changes)
  const handlePromptChange = useCallback((newPrompt) => {
    const txt = typeof newPrompt === 'string' ? newPrompt : '';
    // Determine the first token (strip trailing punctuation , . :)
    const firstToken = (txt.split(/\s+/)[0] || '').replace(/[,:.]+$/, '');
    const match = jewelryTypes.find(t => t.label.toLowerCase() === firstToken.toLowerCase());
    if (match) {
      if (selectedJewelryType !== match.id) {
        setSelectedJewelryType(match.id);
        setSelectedLabel(match.label);
      }
    } else {
      if (selectedJewelryType) {
        setSelectedJewelryType('');
        setSelectedLabel('');
      }
    }
    setPrompt(txt);
  }, [jewelryTypes, selectedJewelryType]);
  
  // Handle jewelry type selection
  const selectJewelryType = useCallback((type, label) => {
    if (type === selectedJewelryType) {
      // If selecting the same type, clear it
      setSelectedJewelryType('');
      setSelectedLabel('');
      setPrompt('');
    } else {
      // Set the new type and label
      setSelectedJewelryType(type);
      setSelectedLabel(label);
      setPrompt(label); // Restore setting the prompt for UI display
    }
  }, [selectedJewelryType]);
  
  // Handle preset toggle
  const togglePreset = useCallback((preset, newSelectedPresets = null) => {
    if (newSelectedPresets) {
      setSelectedPresets(
        newSelectedPresets.includes(preset.id)
          ? newSelectedPresets
          : [...newSelectedPresets, preset.id]
      );
    } else {
      setSelectedPresets((prev) =>
        prev.includes(preset.id)
          ? prev.filter((id) => id !== preset.id)
          : [...prev, preset.id]
      );
    }
  }, []);
  
  // Handle presets modal
  const openPresetsModal = useCallback(() => {
    setIsPresetsModalOpen(true);
  }, []);
  
  const closePresetsModal = useCallback(() => {
    setIsPresetsModalOpen(false);
  }, []);

  
  
  // Get final prompt (combining prompt and presets)
  const getFinalPrompt = useCallback(() => {
    // CRITICAL FIX: Ensure presets are always included with text prompt
    console.log('PROMPT CONTEXT STATE:', {
      prompt,
      selectedJewelryType,
      selectedLabel,
      selectedPresets,
      presetsCount: selectedPresets.length
    });
    
    // Build the final prompt from multiple sources
    let components = [];
    
    // Since we're now setting the prompt field to the jewelry type,
    // we don't need to add the jewelry type separately
    // Just use the prompt field which already contains the jewelry type
    
    // Add user's text input from the prompt field
    if (prompt && prompt.trim() !== '') {
      components.push(prompt);
      console.log('Added text input to prompt (includes jewelry type if selected):', prompt);
    }
    
    // 3. Add presets if selected
    if (selectedPresets.length > 0) {
      const presetItems = presets.filter(preset => selectedPresets.includes(preset.id));
      console.log('Found preset items:', presetItems.map(p => p.name).join(', '));
      
      // Group presets by section for better organization
      const presetsBySection = {};
      presetItems.forEach(preset => {
        if (!presetsBySection[preset.section]) {
          presetsBySection[preset.section] = [];
        }
        // Use the 'value' property instead of 'prompt'
        presetsBySection[preset.section].push(preset.value);
      });
      
      // Combine presets by section first, then join sections
      const sectionPrompts = [];
      Object.values(presetsBySection).forEach(sectionPresets => {
        if (sectionPresets.length > 0) {
          sectionPrompts.push(sectionPresets.join(', '));
        }
      });
      
      const presetPrompts = sectionPrompts.join(', ');
      if (presetPrompts) {
        components.push(presetPrompts);
        console.log('Added presets to prompt:', presetPrompts);
      }
    }
    
    // Combine all components with commas
    let finalPrompt = components.join(', ');
    
    // Remove any trailing commas and extra spaces
    finalPrompt = finalPrompt.replace(/,\s*,/g, ',').replace(/^\s*,\s*|\s*,\s*$/g, '').trim();
    
    console.log('FINAL COMBINED PROMPT:', finalPrompt);
    console.log('Final prompt components:', { selectedJewelryType, selectedLabel, prompt, presets: selectedPresets.length, finalPrompt });
    
    return finalPrompt;
  }, [prompt, selectedPresets, selectedJewelryType, selectedLabel]);
  
  // Clear all
  const clearAll = useCallback(() => {
    setPrompt('');
    setSelectedJewelryType('');
    setSelectedLabel('');
    setSelectedPresets([]);
  }, []);
  
  // Direct prompt setter for external components
  const setPromptDirectly = useCallback((newPrompt) => {
    setPrompt(newPrompt);
    // Clear jewelry type selection when prompt is set directly
    setSelectedJewelryType('');
    setSelectedLabel('');
  }, []);

  // Memoize the context value
  const contextValue = useMemo(() => {
    const value = {
      // Prompt
      prompt,
      setPrompt: handlePromptChange,
      setPromptDirectly,
      
      // Jewelry type
      jewelryTypes,
      selectedJewelryType,
      selectedLabel,
      selectJewelryType,
      
      // Presets
      selectedPresets,
      togglePreset,
      isPresetsModalOpen,
      openPresetsModal,
      closePresetsModal,
      
      // Final prompt
      getFinalPrompt,
      
      // Clear
      clearAll
    };
    
    // Store the context value in the ref
    contextRef.current = value;
    
    return value;
  }, [
    prompt, 
    handlePromptChange, 
    setPromptDirectly,
    jewelryTypes, 
    selectedJewelryType, 
    selectedLabel, 
    selectJewelryType, 
    selectedPresets, 
    togglePreset, 
    isPresetsModalOpen, 
    openPresetsModal, 
    closePresetsModal, 
    getFinalPrompt, 
    clearAll
  ]);
  
  return (
    <PromptContext.Provider value={contextValue}>
      {children}
    </PromptContext.Provider>
  );
}

// Custom hook to use the context
export function usePromptContext() {
  const context = useContext(PromptContext);
  if (!context) {
    throw new Error('usePromptContext must be used within a PromptProvider');
  }
  return context;
}
