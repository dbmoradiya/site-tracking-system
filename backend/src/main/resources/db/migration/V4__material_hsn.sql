-- Optional HSN code on the material type. Existing materials keep an empty HSN.
alter table material_types add column hsn varchar(16);
