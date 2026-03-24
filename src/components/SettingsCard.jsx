const SettingsCard = ({ title, children, className = '' }) => {
  return (
    <section className={`settings-card ${className}`.trim()}>
      <h3 className="settings-card-title">{title}</h3>
      <div className="settings-card-body">{children}</div>
    </section>
  );
};

export default SettingsCard;
