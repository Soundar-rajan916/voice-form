import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { brandConfig } from '../brand';

export function ApplicationA4Print({ submission, form, fields = [], answers = [], lang = 'ta' }) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const ref = submission?.reference_number || 'CS-DEMO-REF1';
  const office = lang === 'ta' ? brandConfig.officeNameTa : brandConfig.officeName;
  const disclaimer = lang === 'ta' ? brandConfig.disclaimerTa : brandConfig.disclaimerEn;

  useEffect(() => {
    if (ref) {
      QRCode.toDataURL(ref, { width: 140, margin: 1 }, (err, url) => {
        if (!err) setQrDataUrl(url);
      });
    }
  }, [ref]);

  const chars = ref.split('');
  const answersMap = (answers || []).reduce((acc, a) => {
    acc[a.field_id] = a.value;
    return acc;
  }, {});

  const dateStr = submission?.submitted_at
    ? new Date(submission.submitted_at).toLocaleString(lang === 'ta' ? 'ta-IN' : 'en-IN')
    : new Date().toLocaleString();

  const consentStr = submission?.consent_at
    ? `${new Date(submission.consent_at).toLocaleString()} (Noted by: ${submission.consent_noted_by || 'citizen'})`
    : 'Consent recorded on initiation';

  return (
    <div className="application-a4-copy bg-[#FCFCFA] text-[#23272F] p-8 max-w-4xl mx-auto border-2 border-[#23272F] font-sans-counter">
      {/* Top Header */}
      <div className="flex items-start justify-between border-b-2 border-[#23272F] pb-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold font-serif-printed text-[#23272F]">{office}</h1>
          <h2 className="text-xl font-bold text-[#1F3FBF] mt-1">{form?.title || 'Citizen Service Application'}</h2>
          <p className="text-xs text-[#23272F]/70 mt-1 italic">{disclaimer}</p>
        </div>

        {/* Rubber Received Stamp */}
        <div className="stamp-received">
          <div className="text-center">
            <span className="block text-xs">{lang === 'ta' ? 'அலுவலகம்' : 'OFFICE'}</span>
            <span className="text-lg">{lang === 'ta' ? 'பெறப்பட்டது' : 'RECEIVED'}</span>
          </div>
        </div>
      </div>

      {/* Reference Number & QR Section */}
      <div className="flex items-center justify-between bg-[#E3E7EC]/50 p-4 border border-[#23272F] rounded mb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#23272F]/80 mb-2">
            {lang === 'ta' ? 'விண்ணப்ப குறிப்பு எண் (Reference Number)' : 'Application Reference Number'}
          </p>
          <div className="boxed-cells">
            {chars.map((c, i) => (
              <span key={`cell-${i}`} className="boxed-char">
                {c}
              </span>
            ))}
          </div>
          <div className="mt-3 text-xs space-y-0.5 text-[#23272F]/80">
            <p><strong>{lang === 'ta' ? 'சமர்ப்பிக்கப்பட்ட நாள்:' : 'Submitted Date:'}</strong> {dateStr}</p>
            <p><strong>{lang === 'ta' ? 'விண்ணப்ப முறை:' : 'Channel:'}</strong> {submission?.channel || 'self_service'} | <strong>ID:</strong> {submission?.kiosk_id || submission?.assisted_by || 'Kiosk-01'}</p>
            <p><strong>{lang === 'ta' ? 'ஒப்புதல் பதிவு:' : 'Consent Recorded:'}</strong> {consentStr}</p>
          </div>
        </div>

        {qrDataUrl && (
          <div className="text-center pl-4 border-l border-[#23272F]/30">
            <img src={qrDataUrl} alt="Reference QR" className="w-24 h-24 object-contain mx-auto" />
            <span className="text-[10px] text-[#23272F]/70 font-mono block mt-1">{ref}</span>
          </div>
        )}
      </div>

      {/* Form Fields and Answers Table */}
      <div className="border border-[#23272F] rounded overflow-hidden mb-6">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#E3E7EC] border-b border-[#23272F] text-xs font-bold uppercase">
              <th className="p-3 w-12 text-center">#</th>
              <th className="p-3 w-1/2">{lang === 'ta' ? 'கேள்வி / விவரம்' : 'Question / Field'}</th>
              <th className="p-3">{lang === 'ta' ? 'விண்ணப்பதாரர் அளித்த பதில்' : 'Applicant Answer'}</th>
            </tr>
          </thead>
          <tbody>
            {(fields || []).map((f, idx) => {
              const qText = lang === 'ta' && f.question_ta ? f.question_ta : (f.question_en || f.field_name);
              const ansVal = answersMap[f.id] || (lang === 'ta' ? '—' : '—');
              return (
                <tr key={f.id || idx} className="border-b border-[#E3E7EC] hover:bg-[#FFE45C]/20 transition">
                  <td className="p-3 text-center text-xs font-mono text-[#23272F]/70">{idx + 1}</td>
                  <td className="p-3 text-sm font-medium text-[#23272F]">{qText}</td>
                  <td className="p-3 text-base pen-blue-text font-semibold">
                    {ansVal}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer & Declaration */}
      <div className="border-t border-[#23272F] pt-4 text-xs text-[#23272F]/80 flex justify-between items-end">
        <div>
          <p className="font-semibold text-[#1F3FBF]">
            {lang === 'ta'
              ? 'விண்ணப்ப நகல் அலுவலகப் பயன்பாட்டிற்காக உருவாக்கப்பட்டது.'
              : 'This copy was generated for office processing and citizen record.'}
          </p>
          <p className="italic text-[11px] mt-1">{disclaimer}</p>
        </div>
        <div className="text-right">
          <div className="w-48 border-b border-[#23272F] mb-1"></div>
          <span className="text-[10px] uppercase font-mono">{lang === 'ta' ? 'அலுவலர் கையொப்பம்' : 'Officer Signature / Stamp'}</span>
        </div>
      </div>
    </div>
  );
}

export default ApplicationA4Print;
