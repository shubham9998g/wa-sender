import React, { useState } from 'react';
import {
  Code,
  Terminal,
  ArrowRight,
  Check,
  Eye,
  AlertCircle,
  Copy,
  Sparkles,
  Send,
  ShieldAlert
} from 'lucide-react';
import { Campaign, CampaignRecord, FieldMapping } from '../../types';
import { maskPayloadSecrets } from '../../../lib/curl-parser';

interface CurlMappingTabProps {
  campaign: Campaign;
  sampleRecord: CampaignRecord | null;
  onParseCurl: (curlString: string) => Promise<void>;
  onSaveMapping: (mapping: FieldMapping) => Promise<void>;
  onTestSend: (count: number) => Promise<void>;
}

export const CurlMappingTab: React.FC<CurlMappingTabProps> = ({
  campaign,
  sampleRecord,
  onParseCurl,
  onSaveMapping,
  onTestSend
}) => {
  const [curlText, setCurlText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Local state for field mappings
  const [mapping, setMapping] = useState<FieldMapping>(() => ({
    destination: campaign.field_mapping?.destination || '',
    userName: campaign.field_mapping?.userName || '',
    templateParams: { ...(campaign.field_mapping?.templateParams || {}) },
    media: { ...(campaign.field_mapping?.media || {}) }
  }));

  // Available CSV columns from sample record
  const csvColumns = sampleRecord?.source_data ? Object.keys(sampleRecord.source_data) : [];

  const handleParse = async () => {
    if (!curlText.trim()) {
      setParseError('Please paste a cURL command');
      return;
    }
    setIsParsing(true);
    setParseError(null);
    try {
      await onParseCurl(curlText.trim());
      // Refresh local mapping from campaign
      if (campaign.field_mapping) {
        setMapping({
          destination: campaign.field_mapping.destination || '',
          userName: campaign.field_mapping.userName || '',
          templateParams: { ...(campaign.field_mapping.templateParams || {}) },
          media: { ...(campaign.field_mapping.media || {}) }
        });
      }
    } catch (err: any) {
      setParseError(err.message || 'Failed to parse cURL command');
    } finally {
      setIsParsing(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await onSaveMapping(mapping);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setParseError(err.message || 'Failed to save mappings');
    } finally {
      setIsSaving(false);
    }
  };

  const loadSampleCurl = () => {
    const sample = `curl -X POST "https://api.vartalaap.io/api/v2/broadcast/api/send" \\
-H "Content-Type: application/json" \\
--data-raw '{"apiKey":"VARTALAAP_SECRET_KEY","campaignName":"${campaign.name || '10be_certificate'}","destination":"+919998546899","userName":"Vartalaap","templateParams":[],"source":"API Broadcast","media":["https://URL"],"buttons":[],"carouselCards":[],"location":[],"limitedTimeOffer":[]}'`;
    setCurlText(sample);
  };

  const parsed = campaign.parsed_template;
  const detected = parsed?.detected;
  const maskedBody = parsed?.body ? maskPayloadSecrets(parsed.body) : null;

  return (
    <div className="space-y-6">
      {/* cURL Input Card */}
      <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center space-x-2">
            <Terminal className="h-5 w-5 text-emerald-600" />
            <h3 className="text-base font-semibold text-zinc-900">WhatsApp API cURL Configuration</h3>
          </div>
          <button
            type="button"
            onClick={loadSampleCurl}
            className="inline-flex items-center space-x-1 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 hover:bg-emerald-100 cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Load Vartalaap cURL Template</span>
          </button>
        </div>

        <p className="text-xs text-zinc-500 mb-3">
          Paste your Linux/macOS (<code>\</code>) or Windows (<code>^</code>) cURL request. The parser will detect dynamic fields,
          template parameters, and media arrays.
        </p>

        <textarea
          id="textarea-curl-input"
          rows={6}
          value={curlText}
          onChange={(e) => setCurlText(e.target.value)}
          placeholder={`curl -X POST "https://api.vartalaap.io/api/v2/broadcast/api/send" \\\n-H "Content-Type: application/json" \\\n--data-raw '{"apiKey":"...","campaignName":"certificate","destination":"+919998546899","media":["https://URL"]}'`}
          className="w-full font-mono text-xs p-3.5 rounded-xl border border-zinc-300 bg-zinc-900 text-emerald-400 focus:border-emerald-500 focus:outline-hidden"
        />

        {parseError && (
          <div className="mt-3 p-3 rounded-xl border border-red-200 bg-red-50 text-xs text-red-700 flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{parseError}</span>
          </div>
        )}

        <div className="mt-3 flex justify-end">
          <button
            id="btn-parse-curl"
            type="button"
            disabled={isParsing || !curlText.trim()}
            onClick={handleParse}
            className="inline-flex items-center space-x-2 px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 cursor-pointer shadow-xs"
          >
            {isParsing ? (
              <span>Parsing cURL...</span>
            ) : (
              <>
                <Code className="h-4 w-4" />
                <span>Parse cURL Request</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Field Mapping Form */}
      {parsed && (
        <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div>
              <h3 className="text-base font-semibold text-zinc-900">Dynamic Field Mapping</h3>
              <p className="text-xs text-zinc-500">Map WhatsApp API parameters to contact spreadsheet columns</p>
            </div>
            {saveSuccess && (
              <span className="inline-flex items-center space-x-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                <Check className="h-3.5 w-3.5" />
                <span>Mappings Saved & Re-validated!</span>
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold text-zinc-600 uppercase">
                <tr>
                  <th className="py-2.5 px-3">WhatsApp API Field</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3 w-8 text-center"></th>
                  <th className="py-2.5 px-3">Spreadsheet Column (CSV/XLSX)</th>
                  <th className="py-2.5 px-3">Sample Preview</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {/* 1. Destination Field */}
                <tr>
                  <td className="py-3 px-3">
                    <span className="font-mono font-medium text-zinc-900">
                      {detected?.destinationField || 'destination'}
                    </span>
                    <span className="text-red-500 ml-1 font-bold">*</span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono text-[10px]">
                      Phone (E.164)
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center text-zinc-400">
                    <ArrowRight className="h-3.5 w-3.5 inline" />
                  </td>
                  <td className="py-3 px-3">
                    <select
                      id="select-mapping-destination"
                      value={mapping.destination || ''}
                      onChange={(e) => setMapping({ ...mapping, destination: e.target.value })}
                      className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                    >
                      <option value="">-- Select Phone Column --</option>
                      {csvColumns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 px-3 font-mono text-zinc-500">
                    {mapping.destination && sampleRecord?.source_data[mapping.destination]
                      ? sampleRecord.source_data[mapping.destination]
                      : '—'}
                  </td>
                </tr>

                {/* 2. User Name Field */}
                {detected?.userNameField && (
                  <tr>
                    <td className="py-3 px-3">
                      <span className="font-mono font-medium text-zinc-900">
                        {detected.userNameField}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded font-mono text-[10px]">
                        String
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center text-zinc-400">
                      <ArrowRight className="h-3.5 w-3.5 inline" />
                    </td>
                    <td className="py-3 px-3">
                      <select
                        id="select-mapping-username"
                        value={mapping.userName || ''}
                        onChange={(e) => setMapping({ ...mapping, userName: e.target.value })}
                        className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                      >
                        <option value="">-- Optional (Unmapped) --</option>
                        {csvColumns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-3 font-mono text-zinc-500">
                      {mapping.userName && sampleRecord?.source_data[mapping.userName]
                        ? sampleRecord.source_data[mapping.userName]
                        : '—'}
                    </td>
                  </tr>
                )}

                {/* 3. Dynamic Template Parameters */}
                {detected?.templateParams && detected.templateParams.length > 0 ? (
                  detected.templateParams.map((param) => (
                    <tr key={param.path}>
                      <td className="py-3 px-3">
                        <span className="font-mono font-medium text-indigo-700">
                          {param.path}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-mono text-[10px]">
                          Template Param
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center text-zinc-400">
                        <ArrowRight className="h-3.5 w-3.5 inline" />
                      </td>
                      <td className="py-3 px-3">
                        <select
                          value={mapping.templateParams?.[param.path] || ''}
                          onChange={(e) =>
                            setMapping({
                              ...mapping,
                              templateParams: {
                                ...(mapping.templateParams || {}),
                                [param.path]: e.target.value
                              }
                            })
                          }
                          className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                        >
                          <option value="">-- Select Column --</option>
                          {csvColumns.map((col) => (
                            <option key={col} value={col}>
                              {col}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-3 font-mono text-zinc-500">
                        {mapping.templateParams?.[param.path] && sampleRecord?.source_data[mapping.templateParams[param.path]]
                          ? sampleRecord.source_data[mapping.templateParams[param.path]]
                          : '—'}
                      </td>
                    </tr>
                  ))
                ) : null}

                {/* 4. Media Arrays (media[0], media[1], etc.) */}
                {detected?.media && detected.media.length > 0 ? (
                  detected.media.map((m) => (
                    <tr key={m.path}>
                      <td className="py-3 px-3">
                        <span className="font-mono font-medium text-emerald-700">
                          {m.path}
                        </span>
                        <span className="text-red-500 ml-1 font-bold">*</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-mono text-[10px]">
                          Storage Signed URL
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center text-zinc-400">
                        <ArrowRight className="h-3.5 w-3.5 inline" />
                      </td>
                      <td className="py-3 px-3">
                        <select
                          id={`select-mapping-media-${m.index}`}
                          value={mapping.media?.[m.path] || ''}
                          onChange={(e) =>
                            setMapping({
                              ...mapping,
                              media: {
                                ...(mapping.media || {}),
                                [m.path]: e.target.value
                              }
                            })
                          }
                          className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden"
                        >
                          <option value="">-- Select Media File Column --</option>
                          {csvColumns.map((col) => (
                            <option key={col} value={col}>
                              {col}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-3 font-mono text-zinc-500">
                        {mapping.media?.[m.path] && sampleRecord?.source_data[mapping.media[m.path]]
                          ? sampleRecord.source_data[mapping.media[m.path]]
                          : '—'}
                      </td>
                    </tr>
                  ))
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-3 border-t border-zinc-100">
            <button
              id="btn-save-field-mappings"
              type="button"
              disabled={isSaving || !mapping.destination}
              onClick={handleSave}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {isSaving ? (
                <span>Saving & Validating...</span>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Save Field Mappings & Validate</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Raw Parsed Request Preview */}
      {parsed && (
        <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Eye className="h-5 w-5 text-zinc-600" />
              <h3 className="text-base font-semibold text-zinc-900">Parsed Request Blueprint</h3>
            </div>
            <span className="text-xs font-mono text-zinc-500">API secrets automatically masked</span>
          </div>

          <div className="p-3 bg-zinc-900 rounded-xl text-zinc-200 font-mono text-xs overflow-x-auto space-y-2">
            <div>
              <span className="text-amber-400 font-bold">{parsed.method}</span>{' '}
              <span className="text-emerald-400">{parsed.url}</span>
            </div>
            <div className="text-zinc-500 text-[11px]">
              Headers: {JSON.stringify(parsed.headers)}
            </div>
            <div className="pt-1 text-zinc-300">
              Payload Blueprint:
              <pre className="mt-1 text-xs text-emerald-300 overflow-x-auto">
                {JSON.stringify(maskedBody, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Test Send Mode (Section 23) */}
      {parsed && (
        <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-xs">
          <div className="flex items-center space-x-2 mb-2">
            <Send className="h-5 w-5 text-indigo-600" />
            <h3 className="text-base font-semibold text-zinc-900">Test Send Mode</h3>
          </div>
          <p className="text-xs text-zinc-500 mb-4">
            Safely test send to the first approved record(s) to verify API connectivity and WhatsApp delivery before starting the full campaign.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              id="btn-test-send-1"
              onClick={() => onTestSend(1)}
              className="px-4 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 cursor-pointer"
            >
              Test 1 Record
            </button>
            <button
              id="btn-test-send-3"
              onClick={() => onTestSend(3)}
              className="px-4 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 cursor-pointer"
            >
              Test 3 Records
            </button>
            <button
              id="btn-test-send-5"
              onClick={() => onTestSend(5)}
              className="px-4 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 cursor-pointer"
            >
              Test 5 Records
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
