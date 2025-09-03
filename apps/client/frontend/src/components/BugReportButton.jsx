import React, { useState, useCallback, memo } from 'react';
import { BugReportModal } from './BugReportModal';
import { Button } from './ui/button';
import { Bug } from 'lucide-react';

function BugReportButtonComponent({ className }) {
  const [showBugReportModal, setShowBugReportModal] = useState(false);
  
  const handleOpenModal = useCallback(() => {
    setShowBugReportModal(true);
  }, []);
  
  const handleCloseModal = useCallback(() => {
    setShowBugReportModal(false);
  }, []);
  
  return (
    <>
      <Button 
        variant="ghost" 
        size="sm" 
        className="text-zinc-400 hover:text-white gap-2" 
        onClick={handleOpenModal}
      >
        <Bug className="w-4 h-4" />
        Report Bug
      </Button>
      
      {showBugReportModal && (
        <BugReportModal 
          isOpen={showBugReportModal} 
          onClose={handleCloseModal} 
        />
      )}
    </>
  );
}

// Use memo to prevent unnecessary re-renders
export const BugReportButton = memo(BugReportButtonComponent);
