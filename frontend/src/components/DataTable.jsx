import React from 'react';

export const DataTable = ({ columns = [], data = [], keyField = "id", emptyMessage = "No items found." }) => {
  return (
    <div className="bg-[#F3F5F6] border border-[#DDE3E6] rounded-lg overflow-hidden font-sans-ui shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-[#DDE3E6] text-[#2A2D30] font-semibold border-b border-[#DDE3E6]">
              {columns.map((col, idx) => (
                <th key={idx} className="py-3 px-4 font-semibold">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DDE3E6] bg-[#F3F5F6]">
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-8 text-center text-[#2A2D30B3]">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr key={row[keyField]} className="hover:bg-[#DDE3E6]/30 transition-colors">
                  {columns.map((col, idx) => (
                    <td key={idx} className="py-3 px-4 text-[#2A2D30]">
                      {col.render ? col.render(row) : row[col.accessor]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
