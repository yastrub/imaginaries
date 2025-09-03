/*
  # Add Estimated Cost Migration

  This migration adds the estimated_cost column to the images table
  to store jewelry price estimations from OpenAI.
  
  1. New Column in images table:
    - `estimated_cost` (text, nullable): Estimated price range for the jewelry
*/

-- Add estimated_cost field to images table
ALTER TABLE images
ADD COLUMN IF NOT EXISTS estimated_cost text;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_images_estimated_cost ON images(estimated_cost);
