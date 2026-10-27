import React, { useState, useEffect } from 'react';
import { getSMTPSettings, saveSMTPSettings } from '../services/api';

export default function EmailSettings() {
  const [formData, setFormData] = useState({
    sender_name: '',
    sender_email: '',
    reply_to_email: '',
    security_protocol: 'TLS',
    smtp_host: '',
    smtp_port: '',
    smtp_username: '',
    smtp_password: '',
  });

  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await getSMTPSettings();
      setFormData({ ...res.data, smtp_password: '' }); // keep password empty visually
    } catch (err) {
      setStatusMsg({text:'Unable to load email settings. Refresh the page to try again.',type:'error'});
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg({ text: '', type: '' });
    
    try {
      const res = await saveSMTPSettings(formData);
      setStatusMsg({ text: res.data.message, type: 'success' });
      setFormData({ ...formData, smtp_password: '' }); // Clear password field after save
    } catch (err) {
      setStatusMsg({ text: 'Failed to save configuration.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const field = (name,label,type='text',placeholder='') => <div className="admin-field"><label htmlFor={'smtp-'+name}>{label}</label><input id={'smtp-'+name} type={type} name={name} value={formData[name] || ''} onChange={handleChange} placeholder={placeholder} autoComplete={type==='password'?'new-password':undefined}/></div>;
  return <div className="w-full max-w-5xl space-y-5">
    <header className="admin-page-heading"><div><h1>Email settings</h1><p>Configure the sender and mail server used for portal notifications.</p></div></header>
    {statusMsg.text&&<div role={statusMsg.type==='error'?'alert':'status'} className={statusMsg.type==='error'?'admin-error':'admin-notice'}>{statusMsg.text}</div>}
    <form onSubmit={handleSubmit} className="admin-panel">
      <section className="admin-settings-section"><div><h2>Sender details</h2><p>The name and address employees see in their inbox.</p></div><div className="admin-settings-fields">
        {field('sender_name','Sender name')}{field('sender_email','Sender email','email')}{field('reply_to_email','Reply-to email (optional)','email')}
      </div></section>
      <section className="admin-settings-section"><div><h2>Mail server</h2><p>Connection settings supplied by your email provider.</p></div><div className="admin-settings-fields">
        {field('smtp_host','SMTP host')}{field('smtp_port','Port','number')}
        <div className="admin-field"><label htmlFor="smtp-security">Encryption</label><select id="smtp-security" name="security_protocol" value={formData.security_protocol} onChange={handleChange}><option value="TLS">TLS</option><option value="SSL">SSL</option><option value="None">None</option></select></div>
      </div></section>
      <section className="admin-settings-section"><div><h2>Authentication</h2><p>Leave the password blank to keep the saved password.</p></div><div className="admin-settings-fields">
        {field('smtp_username','Username')}{field('smtp_password','Password','password','Leave blank to keep existing')}
      </div></section>
      <footer className="admin-form-footer"><button className="admin-button primary" disabled={loading} type="submit">{loading?'Saving…':'Save settings'}</button></footer>
    </form>
  </div>;
}
