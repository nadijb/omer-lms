-- Fix: clear staff_id values that were incorrectly set to the user's email address
-- Run this once against the test schema to clean up pre-existing bad data.

UPDATE test.auth_users
SET staff_id = NULL
WHERE staff_id = email;
