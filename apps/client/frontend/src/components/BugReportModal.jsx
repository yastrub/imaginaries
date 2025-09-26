import React, { useState, useCallback, memo } from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { useToast } from './ui/use-toast';

function BugReportModalComponent({ isOpen, onClose }) {
  const { toast } = useToast();
  const [reportType, setReportType] = useState('bug');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // If the modal is not open, don't render anything
  if (!isOpen) return null;

  const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB in bytes
  const ALLOWED_FILE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];

  const handleFileChange = useCallback((e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Check file type
      if (!ALLOWED_FILE_TYPES.includes(selectedFile.type)) {
        setSubmitError('Only PNG, JPEG, and PDF files are allowed.');
        toast({
          title: 'Invalid File Type',
          description: 'Please upload only PNG, JPEG, or PDF files.',
          variant: 'destructive',
        });
        return;
      }
      
      // Check file size
      if (selectedFile.size > MAX_FILE_SIZE) {
        setSubmitError(`File size exceeds 25MB limit. Please select a smaller file.`);
        toast({
          title: 'File Too Large',
          description: 'The selected file exceeds the 25MB size limit. Please choose a smaller file.',
          variant: 'destructive',
        });
        return;
      }
      
      setFile(selectedFile);
      setSubmitError(''); // Clear any previous errors
    }
  }, [toast]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');

    try {
      const formData = new FormData();
      formData.append('reportType', reportType);
      formData.append('description', description);
      if (file) {
        formData.append('file', file);
      }

      const response = await fetch('/api/feedback/report', {
        method: 'POST',
        body: formData,
        credentials: 'include', // Include credentials for authentication
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to submit report');
      }

      setSubmitSuccess(true);
      setDescription('');
      setFile(null);
      setReportType('bug');
      
      // Show success toast
      toast({
        title: 'Feedback Submitted',
        description: 'Thank you for your feedback! We\'ll review it shortly.',
        variant: 'success',
      });
      
      // Close the modal after 2 seconds
      setTimeout(() => {
        onClose();
        setSubmitSuccess(false);
      }, 2000);
    } catch (error) {
      console.error('Error submitting report:', error);
      setSubmitError(error.message || 'Failed to submit report. Please try again.');
      
      // Show error toast with specific message for file type errors
      const errorMessage = error.message || 'Failed to submit report. Please try again.';
      const isFileTypeError = errorMessage.includes('Only PNG, JPEG, and PDF');
      
      toast({
        title: isFileTypeError ? 'Invalid File Type' : 'Submission Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [reportType, description, file, toast, onClose]);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={(e) => {
      // Close modal when clicking on backdrop
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="bg-zinc-900 rounded-xl w-full max-w-md relative shadow-xl max-h-[90vh] sm:max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-6">
          <h2 className="text-xl font-semibold mb-1 text-gradient-to-r from-purple-400 to-indigo-300">Submit Feedback</h2>
          <p className="text-sm text-gray-600 mb-4">
            Your feedback helps us improve Imaginaries. We appreciate your input!
          </p>

          {submitSuccess ? (
            <div className="bg-green-900/20 border border-green-900 rounded-md p-4 mb-4">
              <p className="text-green-200">Thank you for your feedback! We'll review it shortly.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <Label className="block mb-2 text-purple-300 font-medium">Report Type</Label>
                <RadioGroup 
                  value={reportType} 
                  onValueChange={setReportType}
                  className="flex gap-4"
                >
                  <RadioGroupItem value="bug" id="bug" className="text-white">
                    <span className="text-white">Bug Report</span>
                  </RadioGroupItem>
                  <RadioGroupItem value="feature" id="feature" className="text-white">
                    <span className="text-white">Feature Request</span>
                  </RadioGroupItem>
                </RadioGroup>
              </div>

              <div className="mb-4">
                <Label htmlFor="description" className="block mb-2 text-purple-300 font-medium">
                  {reportType === 'bug' ? 'Describe the bug' : 'Describe the feature'}
                </Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={reportType === 'bug' 
                    ? 'What happened? What did you expect to happen?'
                    : 'What feature would you like to see?'}
                  className="w-full h-32 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus:ring-primary"
                  required
                />
              </div>

              <div className="mb-4">
                <Label htmlFor="file" className="block mb-2 text-purple-300 font-medium">
                  {reportType === 'bug' 
                    ? 'Attach Screenshot (optional)' 
                    : 'Attach Reference (optional)'}
                  <span className="text-xs text-indigo-400 ml-1">(PNG, JPEG, PDF - max 25MB)</span>
                </Label>
                <div className="border-2 border-dashed border-zinc-700 rounded-md p-4 text-center bg-zinc-800/50">
                  <input
                    type="file"
                    id="file"
                    onChange={handleFileChange}
                    className="hidden"
                    accept="image/png,image/jpeg,image/jpg,application/pdf"
                  />
                  <label 
                    htmlFor="file"
                    className="cursor-pointer text-sm text-indigo-400 hover:text-primary transition-colors"
                  >
                    {file ? (
                      <span className="flex items-center">
                        {file.name}
                        <span className="text-xs text-zinc-500 ml-2">
                          ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                        </span>
                      </span>
                    ) : (
                      'Click to upload or drag and drop'
                    )}
                  </label>
                  {file && (
                    <button 
                      type="button" 
                      onClick={() => setFile(null)}
                      className="ml-2 text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {submitError && (
                <div className="bg-red-900/20 border border-red-900 rounded-md p-3 mb-4">
                  <p className="text-red-200 text-sm">{submitError}</p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting || !description.trim()}
                  className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// Use memo to prevent unnecessary re-renders when props don't change
export const BugReportModal = memo(BugReportModalComponent);
