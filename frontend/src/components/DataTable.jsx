import React from 'react';

export const DataTable = ({ columns = [], data = [], keyField = "id", emptyMessage = "No items found." }) => {
  return (
    <div className="bg-[#F6F8F5] border border-[#DCE7E0] rounded-lg overflow-hidden font-sans-ui text-[#2A2E2C]">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-[#DCE7E0] text-[#2A2E2C] font-semibold border-b border-[#DCE7E0]">
              {columns.map((col, idx) => (
                <th key={idx} className="py-3 px-4 font-semibold">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DCE7E0] bg-[#F6F8F5]">
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-8 text-center text-[#2A2E2C]/75">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr key={row[keyField]} className="hover:bg-[#DCE7E0]/40 transition-colors">
                  {columns.map((col, idx) => (
                    <td key={idx} className="py-3 px-4 text-[#2A2E2C]">
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
