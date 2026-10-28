-- Rebrand: Shreeji Enterprise -> Shreeji Energy. Only touches the company name if it still has the old default;
-- saved challan PDFs are stored files and stay unchanged.
update company_profile set name = 'Shreeji Energy' where id = 1 and name = 'Shreeji Enterprise';
