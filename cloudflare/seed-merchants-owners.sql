-- Pemilik (users.id) untuk 3 merchant hasil seed foto 2026-11-03.
UPDATE merchants SET user_id = CASE id WHEN 10 THEN 2 WHEN 11 THEN 5 WHEN 12 THEN 6 END WHERE id IN (10,11,12);
DELETE FROM menus WHERE name IN ('Menu Uji FE','Uji M5');
