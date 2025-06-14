import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ProductService } from './product.service';
import { Product } from './product.model';
import { MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { QtyTypesService } from '../qty-types/qty-types.service';
import { SupplierService } from '../supplier/supplier.service';
import { ISupplierDto } from '../../../models/supplier/supplier.dto';
import { ProductPrice } from '../../../models/product-price/product-price.model';
import { ProductPriceService } from '../product-price/product-price.service';
import { QtyService } from '../qty/qty.service';
import { CreateQtyDto } from '../../../models/create-qty.dto';
import { QtyType } from '../../../models/qty-type/qty-type';
import { SelectChangeEvent } from 'primeng/select';

@Component({
  selector: 'app-product',
  templateUrl: './product.component.html',
  styleUrls: ['./product.component.scss'],
  providers: [MessageService]
})
export class ProductComponent implements OnInit {

  products: Product[] = [];
  qtyTypes: QtyType[] = [];
  productPrices: ProductPrice[] = [];
  productRelatedPrices: ProductPrice[] = [];
  suppliers: ISupplierDto[] = [];
  displayModal = false;
  isEditMode = false;
  currentProduct: Product = this.getEmptyProduct();
  deleteId: number | null = null;
  @ViewChild('dt') dt: Table | undefined;
  visible: boolean = false;
  quantity: number = 0;
  qrAndBarcodeVisible: boolean = false;
  @ViewChild('barcode') barcodeElement!: ElementRef;
  @ViewChild('qrcode') qrCodeElement!: ElementRef;
  showDialogQRAndBarCode() {
    this.qrAndBarcodeVisible = true;
  }
  currentProductPrice: ProductPrice = {
    id: 0,
    wholeSalePrice: 0,
    broughtPrice: 0,
    primarySalePrice: 0,
    product: this.currentProduct as Product,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  constructor(
    private productService: ProductService,
    private messageService: MessageService,
    private qtyTypesService: QtyTypesService,
    private supplierService: SupplierService,
    private productPriceService: ProductPriceService,
    private qtyService: QtyService
  ) { }

  ngOnInit(): void {
    this.loadProducts();
    this.loadQtyTypes();
    this.loadSuppliers();
    this.loadProductsPrices();
  }
  loadProductsPrices() {
    this.productPriceService.getAll().subscribe({
      next: (data) => {
        this.productPrices = data;
      },
      error: () => this.showToast('Failed to load product prices', 'error')
    });
  }

  filterPricessByProductId(productId: number) {
    if (!productId) {
      this.productRelatedPrices = [];
      return;
    }
    this.productRelatedPrices = this.productPrices.filter(price => price.product.id === productId);
    console.log('Filtered Prices:', this.productRelatedPrices);
  }

  changeCurrentPrice(event: SelectChangeEvent) {
    console.log('Selected Price:', event.value);
    this.currentProduct.currentPrice = this.productPrices.find(price => price.id === event.value)?.primarySalePrice || 0;
  }

  loadQtyTypes() {
    this.qtyTypesService.getQtyTypes().subscribe((response: QtyType[]) => {
      this.qtyTypes = response.map((item: QtyType) => ({
        id: item.id,
        name: item.name,
        primaryWeightTo: item.primaryWeightTo,
        mainQtyId: item.mainQtyId,
      }));
    });
  }

  loadSuppliers() {
    this.supplierService.getSuppliers().subscribe((response: ISupplierDto[]) => {
      this.suppliers = response.map((item: ISupplierDto) => ({
        id: item.id,
        name: item.name,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }));
    });
  }

  loadProducts() {
    this.productService.getProducts().subscribe({
      next: (data) => (this.products = data),
      error: () => this.showToast('Failed to load products', 'error')
    });
  }

  showAddModal() {
    this.isEditMode = false;
    this.currentProduct = this.getEmptyProduct();
    this.displayModal = true;
  }

  editProduct(product: Product) {
    this.isEditMode = true;
    this.currentProduct = {
      ...product
      ,
      supplierId: product.supplier?.id || 0, // Handle optional supplier
      qtyTypeId: product.qtyType?.id || 0,
      productPriceId: product.productPriceId || 0 // Handle optional product price
    };
    this.filterPricessByProductId(this.currentProduct.id!);
    this.displayModal = true;
    console.log('Editing product:', this.currentProduct);
  }

  closeModal() {
    this.displayModal = false;
  }

  saveProduct() {
    if (this.isEditMode && this.currentProduct.id) {
      this.productService.updateProduct(this.currentProduct.id.toString(), this.currentProduct).subscribe({
        next: () => {
          this.displayModal = false;
          this.loadProducts();
          this.showToast('Product updated successfully', 'success');

        },
        error: (e) => {
          this.showToast('Failed to update product', 'error')
          console.error('Error updating product:', e);
        }
      });
    } else {
      this.productService.addProduct(this.currentProduct).subscribe({
        next: (product: Product) => {
          this.showToast('Product added successfully', 'success');
          this.currentProduct = product;
          this.saveProductPrice({
            ...this.currentProductPrice,
            product: product
          });

          this.loadProducts();
          this.displayModal = false;
        },
        error: () => this.showToast('Failed to add product', 'error')
      });
    }
  }
  saveQty(qty: CreateQtyDto) {
    if (this.currentProduct.id) {
      this.qtyService.createQuantity({
        productId: qty.productId, // ID of the associated product
        qtyTypeId: qty.qtyTypeId, // ID of the associated QtyType
        qty: qty.qty
      }).subscribe({
        next: () => {
          this.showToast('Quantity saved successfully', 'success');
          this.quantity = 0; // Reset quantity after saving
        },
        error: () => this.showToast('Failed to save quantity', 'error')
      });
    } else {
      this.showToast('Please select a product first', 'error');
    }
  }


  private saveProductPrice(product: ProductPrice) {
    this.productPriceService.create(product).subscribe({
      next: () => {
        this.showToast('Product price added successfully', 'success');
        this.emptyProductPrice();
        this.saveQty({
          productId: product.product.id!,
          qtyTypeId: product.product.qtyType?.id!,
          qty: this.quantity
        })
      },
      error: () => this.showToast('Failed to add product price', 'error')
    });
  }

  emptyProductPrice() {
    this.currentProductPrice = {
      id: 0,
      wholeSalePrice: 0,
      broughtPrice: 0,
      primarySalePrice: 0,
      product: this.currentProduct as Product,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  confirmDeleteProduct(product: Product) {
    this.deleteId = product.id!;
    this.messageService.clear('confirm');
    this.messageService.add({
      key: 'confirm',
      sticky: true,
      severity: 'warn',
      summary: `Are you sure you want to delete product "${product.name}"?`
    });
  }

  onConfirmDelete() {
    if (this.deleteId) {
      this.productService.deleteProduct(this.deleteId).subscribe({
        next: () => {
          this.showToast('Product deleted', 'success');
          this.loadProducts();
        },
        error: () => this.showToast('Failed to delete product', 'error')
      });
      this.deleteId = null;
      this.messageService.clear('confirm');
    }
  }

  showToast(message: string, severity: 'success' | 'error') {
    this.messageService.add({ severity, summary: message, life: 3000 });
  }

  getEmptyProduct(): Product {
    return {
      id: 0,
      name: '',
      description: '',
      barCode: '',
      qrCode: '',
      category: '',
      subcategory: '',
      currentPrice: 0,
      warranty: 0,
      supplierId: 0,
      qtyTypeId: 0
    };
  }
  applyFilterGlobal($event: any, stringVal: any) {
    this.dt!.filterGlobal(($event.target as HTMLInputElement).value, stringVal);
  }

  onRejectDelete() {
    this.messageService.clear('confirm');
    this.visible = false;
  }


  isBarcodeTaken: boolean = false;

  //should improve 
  checkBarcodeUniqueness(event: Event) {

    const exists = this.products.some(p =>
      p.barCode === this.currentProduct.barCode && p.id !== this.currentProduct.id
    );
    this.isBarcodeTaken = exists;
    this.showToast(
      exists ? 'Barcode already exists' : 'Barcode is unique',
      exists ? 'error' : 'success'
    );
    if(exists) {
      (event.target as HTMLInputElement).value = ''; // Clear the input if barcode is taken
    }
  }

  // Barcode download
  downloadBarcode() {
    const svg = this.barcodeElement.nativeElement.querySelector('svg');
    if (!svg) return;

    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);

    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    this.triggerDownload(url, `${this.currentProduct.name}.barcode.svg`);

  }

  // QRCode download
  downloadQRCode() {
    const canvas = this.qrCodeElement.nativeElement.querySelector('canvas');
    if (!canvas) return;

    canvas.toBlob((blob: Blob | MediaSource) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      this.triggerDownload(url, `${this.currentProduct.name}.qrcode.svg`);

    });
  }

  private triggerDownload(url: string, filename: string) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
  }


}