import { BadRequestException } from '@nestjs/common';
import { UploadService } from './upload.service';

describe('UploadService validation', () => {
  const service = new UploadService();
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const file = (mimetype: string, buffer: Buffer, size = buffer.length) => ({ mimetype, buffer, size }) as Express.Multer.File;

  it('accepts a real PNG', () => {
    expect(() => service.validateImage(file('image/png', png))).not.toThrow();
  });

  it('rejects a script or HTML file that claims to be an image', () => {
    const html = Buffer.from('<script>alert(1)</script>');
    expect(() => service.validateImage(file('image/png', html))).toThrow(BadRequestException);
    expect(() => service.validateImage(file('image/jpeg', html))).toThrow(BadRequestException);
  });

  it('rejects a real PNG labelled as something else, and non-image types', () => {
    expect(() => service.validateImage(file('image/jpeg', png))).toThrow(BadRequestException);
    expect(() => service.validateImage(file('text/html', png))).toThrow(BadRequestException);
  });

  it('never keeps a dangerous extension in the stored name', () => {
    for (const bad of ['x.html', 'x.svg', 'x.js', 'x.php', 'x.png.html', 'x']) {
      expect(() => service.generateFilename(bad, 'img')).toThrow(BadRequestException);
    }
    expect(service.generateFilename('Photo.PNG', 'img')).toMatch(/^img-\d+-\d+\.png$/);
  });
});
