-- Update all existing profiles to super_admin to grant access in development
UPDATE profiles SET role = 'super_admin' WHERE role != 'super_admin';
