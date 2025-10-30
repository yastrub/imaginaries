import React from 'react';
import { useViewportOverlay } from '../hooks/useViewportOverlay';
import { X } from 'lucide-react';
import { Button } from './ui/button';

export function RefundPolicyModal({ onClose }) {
  const overlayStyle = useViewportOverlay();
  return (
    <div className="fixed bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 overflow-y-auto" style={overlayStyle}>
      <div className="bg-zinc-900 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-xl relative">
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-zinc-900 z-10">
          <h2 className="text-xl font-semibold text-white">Refund Policy</h2>
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
            <p>
              Our service is a bespoke, made-to-order jewelry production process. Because each piece is uniquely designed and crafted to a customer's specifications, <strong>we do not issue refunds</strong> once an order has been placed.
            </p>

            <h3>Cancellations within 48 hours</h3>
            <p>
              If you cancel your order within <strong>48 hours</strong> of placing it, we will refund the full amount <strong>minus 500 AED</strong>.* This charge covers our product design service, as our CAD designers begin working on your design immediately after an order is submitted.
            </p>
            <p className="text-sm text-zinc-500">* The 500 AED fee is a non-refundable CAD/design service charge.</p>

            <h3>No detailed specs prior to production</h3>
            <p>
              We are unable to provide exhaustive technical specifications of the final product before it is actually made. However, we will do our best to deliver the piece within the budget and options you selected at checkout.
            </p>

            <h3>If we cannot deliver</h3>
            <p>
              In the unlikely event that we determine we cannot deliver the piece as ordered, we will cancel the order from our side and provide a <strong>100% refund</strong>, provided no production work has started.
            </p>

            <p className="mt-8 text-sm text-zinc-500">Last updated: April 21, 2025</p>
          </div>
        </div>

        <div className="p-6 border-t border-zinc-800 sticky bottom-0 bg-zinc-900 z-10 flex justify-end">
          <Button onClick={onClose} className="sm:w-auto">
            I Understand
          </Button>
        </div>
      </div>
    </div>
  );
}
