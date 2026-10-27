-- GST format is only a warning in the UI, so allow a little more room than the 15-character GSTIN.
alter table company_profile alter column gst type varchar(40);
alter table material_vendors alter column gst type varchar(40);
