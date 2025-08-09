-- Add department_id to complaints table for better department management
ALTER TABLE public.complaints 
ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES public.departments(id);

-- Create an index for better performance
CREATE INDEX IF NOT EXISTS idx_complaints_department ON public.complaints(department_id);

-- Update existing complaints to have department_id based on category's default department
UPDATE public.complaints 
SET department_id = (
  SELECT c.default_department_id 
  FROM public.categories c 
  WHERE c.id = complaints.category_id
)
WHERE department_id IS NULL;

-- Create a trigger to automatically set department_id when a complaint is created
CREATE OR REPLACE FUNCTION public.set_complaint_department()
RETURNS TRIGGER AS $$
BEGIN
  -- If department_id is not set, use the category's default department
  IF NEW.department_id IS NULL THEN
    SELECT default_department_id INTO NEW.department_id
    FROM public.categories
    WHERE id = NEW.category_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS set_complaint_department_trigger ON public.complaints;
CREATE TRIGGER set_complaint_department_trigger
  BEFORE INSERT ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.set_complaint_department();

-- Also create a trigger for updates in case category changes
DROP TRIGGER IF EXISTS update_complaint_department_trigger ON public.complaints;
CREATE TRIGGER update_complaint_department_trigger
  BEFORE UPDATE OF category_id ON public.complaints
  FOR EACH ROW
  WHEN (OLD.category_id IS DISTINCT FROM NEW.category_id)
  EXECUTE FUNCTION public.set_complaint_department();
