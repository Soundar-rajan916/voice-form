export const brandConfig = {
  appName: import.meta.env.VITE_APP_NAME || 'Citizen Desk',
  appNameTa: 'குடிமக்கள் சேவை மையம்',
  officeName: import.meta.env.VITE_OFFICE_NAME || 'Citizen Service Centre',
  officeNameTa: 'சேவை மையம்',
  hospitalName: import.meta.env.VITE_OFFICE_NAME || 'Citizen Service Centre',
  emergencyNumbers: '',
  disclaimerEn: 'This is an application helper and not an official government portal.',
  disclaimerTa: 'இது ஒரு விண்ணப்ப உதவி தளம் மட்டுமே, அதிகாரப்பூர்வ அரசு இணையதளம் அல்ல.',
};

export function getRoleLabel(role, lang = 'en') {
  if (role === 'admin') {
    return lang === 'ta' ? 'நிர்வாகி (Admin)' : 'Administrator';
  }
  if (role === 'operator') {
    return lang === 'ta' ? 'உதவி மைய அலுவலர் (Operator)' : 'Help-Desk Operator';
  }
  if (role === 'kiosk') {
    return lang === 'ta' ? 'சுய சேவை சாதனம் (Kiosk)' : 'Kiosk Device';
  }
  return lang === 'ta' ? 'குடிமக்கள் (Citizen)' : 'Citizen';
}
