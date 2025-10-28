import React from 'react';
import { useViewportOverlay } from '../hooks/useViewportOverlay';
import { X } from 'lucide-react';
import { Button } from './ui/button';

export function TermsOfUseModal({ onClose }) {
  const overlayStyle = useViewportOverlay();
  return (
    <div className="fixed bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 overflow-y-auto" style={overlayStyle}>
      <div className="bg-zinc-900 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-xl relative">
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-zinc-900 z-10">
          <h2 className="text-xl font-semibold text-white">Terms of Use</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-zinc-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </Button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)] custom-scrollbar">
          <div className="prose prose-invert max-w-none">
            <h3>1. Acceptance of Terms</h3>
            <p>
              By accessing or using IMAGINARIES ("the Platform"), you agree to be bound by these Terms of Use ("Terms"). 
              If you do not agree to all of these Terms, you may not access or use the Platform.
            </p>
            
            <h3>2. Changes to Terms</h3>
            <p>
              We reserve the right to modify these Terms at any time without prior notice. Your continued use of the Platform 
              following any changes constitutes your acceptance of the revised Terms. It is your responsibility to review 
              these Terms periodically for changes.
            </p>
            
            <h3>3. Account Registration</h3>
            <p>
              To access certain features of the Platform, you may be required to register for an account. You agree to provide 
              accurate, current, and complete information during the registration process and to update such information to keep 
              it accurate, current, and complete.
            </p>
            
            <h3>4. Intellectual Property Rights</h3>
            <p>
              <strong>4.1 Platform Content:</strong> All content on the Platform, including but not limited to text, graphics, 
              logos, icons, images, audio clips, digital downloads, and software, is the property of IMAGINARIES or its content 
              suppliers and is protected by international copyright laws.
            </p>
            <p>
              <strong>4.2 User-Generated Content:</strong> By default, all images created on the Platform belong to IMAGINARIES 
              unless otherwise specified in your subscription plan. We reserve the right to use, reproduce, modify, adapt, publish, 
              translate, distribute, and display such content worldwide in any media.
            </p>
            <p>
              <strong>4.3 License:</strong> Subject to your compliance with these Terms, IMAGINARIES grants you a limited, 
              non-exclusive, non-transferable, non-sublicensable license to access and use the Platform for your personal, 
              non-commercial purposes.
            </p>
            
            <h3>5. Prohibited Conduct</h3>
            <p>
              You agree not to:
            </p>
            <ul>
              <li>- Use the Platform to create, upload, or share inappropriate, offensive, or illegal content</li>
              <li>- Violate any applicable laws or regulations</li>
              <li>- Infringe upon the intellectual property rights of others</li>
              <li>- Attempt to gain unauthorized access to the Platform or its related systems</li>
              <li>- Use the Platform in any manner that could damage, disable, overburden, or impair it</li>
              <li>- Harvest or collect user information without consent</li>
              <li>- Use automated means to access or use the Platform without our express permission</li>
            </ul>
            
            <h3>6. User Responsibility</h3>
            <p>
              You take full responsibility for all content generated through your account. You agree to indemnify and hold 
              harmless IMAGINARIES from any claims resulting from your violation of these Terms or your violation of any rights 
              of a third party.
            </p>
            
            <h3>7. Termination</h3>
            <p>
              We reserve the right to terminate or suspend your account and access to the Platform at any time, without notice 
              or explanation, for any reason, including but not limited to a breach of these Terms. We may delete your data 
              and content without prior notice.
            </p>
            
            <h3>8. Disclaimer of Warranties</h3>
            <p>
              THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, 
              INCLUDING, BUT NOT LIMITED TO, IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR 
              NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED OR ERROR-FREE, THAT DEFECTS WILL BE 
              CORRECTED, OR THAT THE PLATFORM OR THE SERVERS THAT MAKE IT AVAILABLE ARE FREE OF VIRUSES OR OTHER HARMFUL 
              COMPONENTS.
            </p>
            
            <h3>9. Limitation of Liability</h3>
            <p>
              IN NO EVENT SHALL IMAGINARIES, ITS OFFICERS, DIRECTORS, EMPLOYEES, OR AGENTS, BE LIABLE FOR ANY INDIRECT, INCIDENTAL, 
              SPECIAL, CONSEQUENTIAL OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION, LOSS OF PROFITS, DATA, USE, GOODWILL, OR 
              OTHER INTANGIBLE LOSSES, RESULTING FROM (I) YOUR ACCESS TO OR USE OF OR INABILITY TO ACCESS OR USE THE PLATFORM; 
              (II) ANY CONDUCT OR CONTENT OF ANY THIRD PARTY ON THE PLATFORM; (III) ANY CONTENT OBTAINED FROM THE PLATFORM; AND 
              (IV) UNAUTHORIZED ACCESS, USE OR ALTERATION OF YOUR TRANSMISSIONS OR CONTENT, WHETHER BASED ON WARRANTY, CONTRACT, 
              TORT (INCLUDING NEGLIGENCE) OR ANY OTHER LEGAL THEORY, WHETHER OR NOT WE HAVE BEEN INFORMED OF THE POSSIBILITY 
              OF SUCH DAMAGE.
            </p>
            
            <h3>10. Data Loss</h3>
            <p>
              We are not responsible for any loss of data, whether due to technical issues, service interruptions, or any other 
              reason. You are solely responsible for maintaining backups of any content you wish to preserve.
            </p>
            
            <h3>11. Governing Law</h3>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which IMAGINARIES 
              is established, without regard to its conflict of law provisions.
            </p>
            
            <h3>12. Severability</h3>
            <p>
              If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated 
              to the minimum extent necessary so that these Terms shall otherwise remain in full force and effect and enforceable.
            </p>
            
            <h3>13. Contact Information</h3>
            <p>
              If you have any questions about these Terms, please contact us at info@imaginaries.app.
            </p>
            
            <p className="mt-8 text-sm text-zinc-500">
              Last updated: April 21, 2025
            </p>
            <p className="mt-8 text-sm text-zinc-500">
            </p>
          </div>
        </div>
        
        <div className="p-6 border-t border-zinc-800 sticky bottom-0 bg-zinc-900 z-10 flex justify-end">
          <Button onClick={onClose} className="sm:w-auto">
            I Understand and Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
