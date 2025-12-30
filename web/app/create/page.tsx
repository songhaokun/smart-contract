'use client';

/**
 * Create Product Page
 * Upload and list a new product
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useDropzone } from 'react-dropzone';
import { parseUnits } from 'viem';
import {
  Upload,
  Image as ImageIcon,
  FileText,
  X,
  Check,
  Loader2,
  AlertCircle,
  Info,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

import { mneeMartConfig } from '@/lib/contracts';
import { uploadProductDirectory } from '@/lib/services/pinata';
import { encryptFile } from '@/lib/services/lit';
import { useProductCounter } from '@/lib/hooks/use-products';
import { 
  formatFileSize, 
  isSupportedAssetType, 
  isSupportedCoverType,
  validateProductForm,
  getErrorMessage,
} from '@/lib/utils';
import { APP_CONFIG, EXTERNAL_LINKS } from '@/lib/constants';
import type { ProductMetadata, UploadState, CreateProductForm } from '@/lib/constants/types';

export default function CreateProductPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  
  // Get current product counter to predict next product ID
  const { data: productCounter } = useProductCounter();

  // Form state
  const [form, setForm] = useState<CreateProductForm>({
    name: '',
    description: '',
    price: '',
    coverFile: null,
    assetFile: null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadProgress, setUploadProgress] = useState<string>('');

  // Contract write
  const { 
    writeContract, 
    data: txHash, 
    isPending: isTxPending,
    reset: resetTx,
  } = useWriteContract();

  const { isLoading: isTxConfirming, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Cover dropzone
  const onCoverDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file && isSupportedCoverType(file.type)) {
      setForm((prev) => ({ ...prev, coverFile: file }));
      setErrors((prev) => ({ ...prev, cover: '' }));
    } else {
      setErrors((prev) => ({ ...prev, cover: 'Invalid image format' }));
    }
  }, []);

  const coverDropzone = useDropzone({
    onDrop: onCoverDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
    },
    maxSize: APP_CONFIG.maxCoverSize,
    multiple: false,
  });

  // Asset dropzone
  const onAssetDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file && isSupportedAssetType(file.type)) {
      setForm((prev) => ({ ...prev, assetFile: file }));
      setErrors((prev) => ({ ...prev, asset: '' }));
    } else {
      setErrors((prev) => ({ ...prev, asset: 'Unsupported file format' }));
    }
  }, []);

  const assetDropzone = useDropzone({
    onDrop: onAssetDrop,
    accept: {
      'application/*': ['.pdf', '.zip'],
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'audio/*': ['.mp3', '.wav'],
      'video/*': ['.mp4', '.webm'],
    },
    maxSize: APP_CONFIG.maxFileSize,
    multiple: false,
  });

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    const { valid, errors: validationErrors } = validateProductForm(form);
    if (!valid) {
      setErrors(validationErrors);
      return;
    }

    if (!address || !form.coverFile || !form.assetFile) return;

    try {
      setUploadState('encrypting');
      setUploadProgress('Encrypting file with Lit Protocol...');

      // Calculate the next product ID based on current counter
      // This is the ID that will be assigned when the product is created
      const nextProductId = productCounter ? Number(productCounter) + 1 : 1;
      
      console.log('Encrypting with predicted product ID:', nextProductId);

      // Encrypt the asset file with the predicted product ID
      // The Access Control Conditions will check: hasUserPurchased(userAddress, nextProductId)
      const { encryptedBlob, litMetadata } = await encryptFile(form.assetFile, nextProductId);

      setUploadState('uploading_asset');
      setUploadProgress('Uploading to IPFS...');

      // Create metadata
      const coverExt = form.coverFile.name.split('.').pop() || 'png';
      const metadata: ProductMetadata = {
        schema: 'meneemart.v1',
        title: form.name,
        shortName: form.name.slice(0, 50),
        description: form.description,
        cover: `ipfs://<RootCID>/cover.${coverExt}`,
        encryptedAsset: 'ipfs://<RootCID>/asset.enc',
        mimeType: form.assetFile.type,
        sizeBytes: form.assetFile.size,
        originalFileName: form.assetFile.name,
        lit: litMetadata,
        createdAt: new Date().toISOString(),
      };

      // Upload directory to IPFS
      const rootCid = await uploadProductDirectory(
        form.coverFile,
        encryptedBlob,
        metadata,
        {
          onProgress: (stage, progress) => {
            setUploadProgress(`Uploading ${stage}... ${progress}%`);
          },
        }
      );

      setUploadState('listing');
      setUploadProgress('Listing on blockchain...');

      // Parse price to wei
      const priceWei = parseUnits(form.price, APP_CONFIG.tokenDecimals);

      // Call contract
      writeContract({
        ...mneeMartConfig,
        functionName: 'listProduct',
        args: [rootCid, priceWei, form.name],
      }, {
        onSuccess: () => {
          setUploadState('waiting_tx');
          setUploadProgress('Waiting for confirmation...');
        },
        onError: (error) => {
          setUploadState('error');
          setUploadProgress('');
          toast({
            title: 'Transaction failed',
            description: getErrorMessage(error),
            variant: 'destructive',
          });
        },
      });

    } catch (error) {
      setUploadState('error');
      setUploadProgress('');
      toast({
        title: 'Upload failed',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  // Handle successful transaction
  if (isTxSuccess && uploadState === 'waiting_tx') {
    setUploadState('success');
    toast({
      title: 'Product listed!',
      description: 'Your product is now available on the marketplace.',
      variant: 'success',
    });
    // Redirect after short delay
    setTimeout(() => router.push('/'), 2000);
  }

  const isSubmitting = uploadState !== 'idle' && uploadState !== 'error' && uploadState !== 'success';

  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Create Product</h1>
        <p className="text-muted-foreground mt-2">
          Upload your digital content and list it on the marketplace
        </p>
      </div>

      {!isConnected ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold">Wallet Not Connected</h3>
            <p className="text-muted-foreground mt-2">
              Please connect your wallet to create a product
            </p>
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Product Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Web3 Development Guide"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              error={!!errors.name}
              disabled={isSubmitting}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Describe your product..."
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              error={!!errors.description}
              disabled={isSubmitting}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description}</p>
            )}
          </div>

          {/* Price */}
          <div className="space-y-2">
            <Label htmlFor="price">Price (MNEE) *</Label>
            <div className="relative">
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="10.00"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                error={!!errors.price}
                disabled={isSubmitting}
                className="pr-16"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                MNEE
              </span>
            </div>
            {errors.price && (
              <p className="text-sm text-destructive">{errors.price}</p>
            )}
          </div>

          {/* Cover Image */}
          <div className="space-y-2">
            <Label>Cover Image *</Label>
            <div
              {...coverDropzone.getRootProps()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                coverDropzone.isDragActive ? 'border-mnee-500 bg-mnee-500/10' : 'border-border hover:border-muted-foreground'
              } ${errors.cover ? 'border-destructive' : ''}`}
            >
              <input {...coverDropzone.getInputProps()} disabled={isSubmitting} />
              {form.coverFile ? (
                <div className="flex items-center justify-center gap-3">
                  <ImageIcon className="h-8 w-8 text-mnee-500" />
                  <div className="text-left">
                    <p className="font-medium">{form.coverFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(form.coverFile.size)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setForm({ ...form, coverFile: null });
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <ImageIcon className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">
                    Drag & drop or click to upload cover image
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PNG, JPG, GIF up to 5MB
                  </p>
                </>
              )}
            </div>
            {errors.cover && (
              <p className="text-sm text-destructive">{errors.cover}</p>
            )}
          </div>

          {/* Asset File */}
          <div className="space-y-2">
            <Label>Digital Asset *</Label>
            <div
              {...assetDropzone.getRootProps()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                assetDropzone.isDragActive ? 'border-mnee-500 bg-mnee-500/10' : 'border-border hover:border-muted-foreground'
              } ${errors.asset ? 'border-destructive' : ''}`}
            >
              <input {...assetDropzone.getInputProps()} disabled={isSubmitting} />
              {form.assetFile ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="h-8 w-8 text-mnee-500" />
                  <div className="text-left">
                    <p className="font-medium">{form.assetFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(form.assetFile.size)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setForm({ ...form, assetFile: null });
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">
                    Drag & drop or click to upload your digital asset
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, ZIP, Images, Audio, Video up to 50MB
                  </p>
                </>
              )}
            </div>
            {errors.asset && (
              <p className="text-sm text-destructive">{errors.asset}</p>
            )}
          </div>

          {/* Team/Safe Notice */}
          <Card className="bg-muted/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Info className="h-4 w-4" />
                Team Tip
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>
                If you&apos;re a team, consider using a{' '}
                <a
                  href={EXTERNAL_LINKS.safe}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-mnee-500 hover:underline"
                >
                  Safe
                </a>{' '}
                or{' '}
                <a
                  href={EXTERNAL_LINKS.splits}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-mnee-500 hover:underline"
                >
                  Splits
                </a>{' '}
                contract as the seller address for automated revenue sharing.
              </p>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <Button
            type="submit"
            size="lg"
            variant="gradient"
            className="w-full gap-2"
            disabled={isSubmitting}
          >
            {uploadState === 'encrypting' && (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Encrypting...
              </>
            )}
            {(uploadState === 'uploading_asset' || uploadState === 'uploading_cover' || uploadState === 'uploading_metadata') && (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading to IPFS...
              </>
            )}
            {uploadState === 'listing' && (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Confirm in Wallet...
              </>
            )}
            {uploadState === 'waiting_tx' && (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Confirming...
              </>
            )}
            {uploadState === 'success' && (
              <>
                <Check className="h-4 w-4" />
                Listed Successfully!
              </>
            )}
            {(uploadState === 'idle' || uploadState === 'error') && (
              <>
                <Upload className="h-4 w-4" />
                Create Product
              </>
            )}
          </Button>

          {/* Progress Message */}
          {uploadProgress && (
            <p className="text-sm text-center text-muted-foreground">
              {uploadProgress}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

