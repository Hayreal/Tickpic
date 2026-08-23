import React from 'react';
import type { SkuSubTab } from '../shared/view/ui';

interface SkuParameterFieldsProps {
  prefix: SkuSubTab;
  brand: string;
  onBrandChange: (value: string) => void;
  productName: string;
  onProductNameChange: (value: string) => void;
  capacity: string;
  onCapacityChange: (value: string) => void;
  productNameRequired?: boolean;
}

export default function SkuParameterFields({
  prefix,
  brand,
  onBrandChange,
  productName,
  onProductNameChange,
  capacity,
  onCapacityChange,
  productNameRequired = false,
}: SkuParameterFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <label className="ui-label" htmlFor={`${prefix}-brand-input`}>品牌</label>
        <input
          type="text"
          id={`${prefix}-brand-input`}
          value={brand}
          onChange={(event) => onBrandChange(event.target.value)}
          placeholder="例如：wkau"
          className="ui-input-compact"
        />
      </div>
      <div className="space-y-2">
        <label className="ui-label" htmlFor={`${prefix}-product-name-input`}>
          {productNameRequired ? <>产品名称 <span className="text-red-500 font-bold">*</span></> : '产品名称'}
        </label>
        <input
          type="text"
          id={`${prefix}-product-name-input`}
          value={productName}
          onChange={(event) => onProductNameChange(event.target.value)}
          placeholder="例如：HEADLIGHT RESTORE、墙面修补膏"
          className="ui-input-compact"
        />
      </div>
      <div className="space-y-2">
        <label className="ui-label" htmlFor={`${prefix}-capacity-input`}>容量</label>
        <input
          type="text"
          id={`${prefix}-capacity-input`}
          value={capacity}
          onChange={(event) => onCapacityChange(event.target.value)}
          placeholder="例如：45ml、100g"
          className="ui-input-compact"
        />
      </div>
    </>
  );
}
