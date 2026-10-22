import * as ExcelJS from 'exceljs';
import { ProductsService } from './products.service';

// The template the admin downloads must be accepted by the importer as-is.
describe('ProductsService bulk import', () => {
  const build = (existing: any = null) => {
    const productModel: any = {
      findOne: jest.fn(() => ({ exec: () => Promise.resolve(existing) })),
      create: jest.fn().mockResolvedValue({}),
    };
    const found = { findById: jest.fn().mockResolvedValue({}) };
    const service = new ProductsService(productModel, found as any, found as any, {} as any);
    return { service, productModel };
  };
  const asFile = (buffer: Buffer) => ({ buffer }) as Express.Multer.File;

  it('creates a published product from the template example row', async () => {
    const { service, productModel } = build();
    const result = await service.bulkUploadFromExcel(asFile(await service.buildImportTemplate()), undefined, 'cat1');

    expect(result).toEqual({ created: 1, updated: 0, errors: [] });
    expect(productModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ sku: 'ACC-DW-500', price: 99, stock: 100, productType: 'dishwash', status: 'published', categoryId: 'cat1' }),
    );
  });

  it('generates a SKU, falls back to type "other", and reports bad rows', async () => {
    const { service, productModel } = build();
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Products');
    ws.addRow(['Name', 'Price', 'Stock', 'Product type']); // order differs from the template
    ws.addRow(['Floor Shine 1L', '₹1,250', 5, 'something odd']);
    ws.addRow(['No price here', '', 1, '']);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());

    const result = await service.bulkUploadFromExcel(asFile(buffer), undefined, 'cat1');

    expect(result.created).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(productModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ price: 1250, productType: 'other', sku: expect.stringMatching(/^FLOOR-SHINE-1L-/) }),
    );
  });

  it('updates the product when the SKU already exists', async () => {
    const existing: any = { save: jest.fn() };
    const { service, productModel } = build(existing);

    const result = await service.bulkUploadFromExcel(asFile(await service.buildImportTemplate()), undefined, 'cat1');

    expect(result.updated).toBe(1);
    expect(productModel.create).not.toHaveBeenCalled();
    expect(existing).toMatchObject({ price: 99, stock: 100 });
    expect(existing.save).toHaveBeenCalled();
  });
});
