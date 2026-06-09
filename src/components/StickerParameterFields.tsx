import React from 'react';

interface StickerFieldProps {
  id: string;
  label: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

function StickerTextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  className = 'space-y-2',
}: StickerFieldProps) {
  return (
    <div className={className}>
      <label className="ui-label" htmlFor={id}>{label}</label>
      <input
        type="text"
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="ui-input-compact"
      />
    </div>
  );
}

interface FieldConfig {
  id?: string;
  label?: React.ReactNode;
  placeholder?: string;
  className?: string;
}

interface StickerParameterFieldsProps {
  prefix: 'copy' | 'variation' | 'original';
  brand: string;
  onBrandChange: (value: string) => void;
  productName: string;
  onProductNameChange: (value: string) => void;
  material: string;
  onMaterialChange: (value: string) => void;
  sellingPoint: string;
  onSellingPointChange: (value: string) => void;
  capacity: string;
  onCapacityChange: (value: string) => void;
  colorScheme: string;
  onColorSchemeChange: (value: string) => void;
  style: string;
  onStyleChange: (value: string) => void;
  colorBlockLayout: string;
  onColorBlockLayoutChange: (value: string) => void;
  showBrand?: boolean;
  showProductName?: boolean;
  showMaterial?: boolean;
  showSellingPoint?: boolean;
  showCapacity?: boolean;
  showColorScheme?: boolean;
  showStyle?: boolean;
  showColorBlockLayout?: boolean;
  brandRequired?: boolean;
  sellingPointRequired?: boolean;
  brandField?: FieldConfig;
  productNameField?: FieldConfig;
  materialField?: FieldConfig;
  sellingPointField?: FieldConfig;
  capacityField?: FieldConfig;
  colorSchemeField?: FieldConfig;
  styleField?: FieldConfig;
  colorBlockLayoutField?: FieldConfig;
}

export default function StickerParameterFields({
  prefix,
  brand,
  onBrandChange,
  productName,
  onProductNameChange,
  material,
  onMaterialChange,
  sellingPoint,
  onSellingPointChange,
  capacity,
  onCapacityChange,
  colorScheme,
  onColorSchemeChange,
  style,
  onStyleChange,
  colorBlockLayout,
  onColorBlockLayoutChange,
  showBrand = true,
  showProductName = true,
  showMaterial = true,
  showSellingPoint = true,
  showCapacity = true,
  showColorScheme = true,
  showStyle = true,
  showColorBlockLayout = true,
  brandRequired = false,
  sellingPointRequired = false,
  brandField,
  productNameField,
  materialField,
  sellingPointField,
  capacityField,
  colorSchemeField,
  styleField,
  colorBlockLayoutField,
}: StickerParameterFieldsProps) {
  return (
    <>
      {showBrand ? (
        <StickerTextField
          id={brandField?.id ?? `${prefix}-brand-input`}
          label={brandField?.label ?? (brandRequired ? <>品牌 <span className="text-red-500 font-bold">*</span></> : '品牌')}
          value={brand}
          onChange={onBrandChange}
          placeholder={brandField?.placeholder ?? '请输入品牌名称'}
          className={brandField?.className}
        />
      ) : null}
      {showProductName ? (
        <StickerTextField
          id={productNameField?.id ?? `${prefix}-product-name-input`}
          label={productNameField?.label ?? '产品名称'}
          value={productName}
          onChange={onProductNameChange}
          placeholder={productNameField?.placeholder ?? '请输入产品名称'}
          className={productNameField?.className}
        />
      ) : null}
      {showMaterial ? (
        <StickerTextField
          id={materialField?.id ?? `${prefix}-material-input`}
          label={materialField?.label ?? '素材'}
          value={material}
          onChange={onMaterialChange}
          placeholder={materialField?.placeholder ?? '例如：插画、实拍、图标元素'}
          className={materialField?.className ?? 'space-y-2 sm:col-span-2'}
        />
      ) : null}
      {showSellingPoint ? (
        <StickerTextField
          id={sellingPointField?.id ?? `${prefix}-selling-point-input`}
          label={sellingPointField?.label ?? (sellingPointRequired ? <>卖点 <span className="text-red-500 font-bold">*</span></> : '卖点')}
          value={sellingPoint}
          onChange={onSellingPointChange}
          placeholder={sellingPointField?.placeholder ?? '例如：持久保湿、0糖0卡'}
          className={sellingPointField?.className ?? 'space-y-2 sm:col-span-2'}
        />
      ) : null}
      {showCapacity ? (
        <StickerTextField
          id={capacityField?.id ?? `${prefix}-capacity-input`}
          label={capacityField?.label ?? '容量'}
          value={capacity}
          onChange={onCapacityChange}
          placeholder={capacityField?.placeholder ?? '例如：50ml、100g、6PIECES'}
          className={capacityField?.className}
        />
      ) : null}
      {showColorScheme ? (
        <StickerTextField
          id={colorSchemeField?.id ?? `${prefix}-color-scheme-input`}
          label={colorSchemeField?.label ?? '色系'}
          value={colorScheme}
          onChange={onColorSchemeChange}
          placeholder={colorSchemeField?.placeholder ?? '例如：莫兰迪色、高对比度、黑白'}
          className={colorSchemeField?.className}
        />
      ) : null}
      {showStyle ? (
        <StickerTextField
          id={styleField?.id ?? `${prefix}-style-input`}
          label={styleField?.label ?? '风格'}
          value={style}
          onChange={onStyleChange}
          placeholder={styleField?.placeholder ?? '例如：极简、赛博朋克、水彩'}
          className={styleField?.className}
        />
      ) : null}
      {showColorBlockLayout ? (
        <StickerTextField
          id={colorBlockLayoutField?.id ?? `${prefix}-color-block-layout-input`}
          label={colorBlockLayoutField?.label ?? '色块排版'}
          value={colorBlockLayout}
          onChange={onColorBlockLayoutChange}
          placeholder={colorBlockLayoutField?.placeholder ?? '例如：上标题下卖点、左右分栏、中心主视觉'}
          className={colorBlockLayoutField?.className ?? 'space-y-2 sm:col-span-2'}
        />
      ) : null}
    </>
  );
}
