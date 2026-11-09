import { randomUUID } from 'crypto';

const bucketName = 'catalog-images';
const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export async function withCatalogImage(supabase, serviceRoleConfigured, file, folder, save) {
    if (!file) return save(null);
    if (!serviceRoleConfigured) throw new Error('Configura SUPABASE_SERVICE_ROLE_KEY para guardar imágenes del catálogo.');
    const extension = extensions[file.mimetype];
    if (!extension) throw new Error('La imagen debe ser JPG, PNG o WebP.');

    const bucket = supabase.storage.from(bucketName);
    const objectPath = `${folder}/${randomUUID()}.${extension}`;
    const { error } = await bucket.upload(objectPath, file.buffer, {
        contentType: file.mimetype,
        upsert: false
    });
    if (error) throw new Error(`No se pudo guardar la imagen en Supabase Storage: ${error.message}`);

    try {
        const { data } = bucket.getPublicUrl(objectPath);
        if (!data?.publicUrl) throw new Error('No se pudo obtener la dirección pública de la imagen.');
        return await save(data.publicUrl);
    } catch (saveError) {
        try {
            const { error: cleanupError } = await bucket.remove([objectPath]);
            if (cleanupError) console.error('No se pudo eliminar la imagen tras fallar el guardado.', cleanupError);
        } catch (cleanupError) {
            console.error('No se pudo eliminar la imagen tras fallar el guardado.', cleanupError);
        }
        throw saveError;
    }
}
