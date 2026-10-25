/** Consistent product-card framing without recolouring, stretching or inventing product detail. */
export async function prepareCardPhoto(file: File): Promise<File> {
  const image=await createImageBitmap(file,{imageOrientation:'from-image'})
  try {
    if(image.width*image.height>40000000)throw new Error('Use a photo smaller than 40 megapixels.')
    const width=Math.min(1200,Math.round(Math.max(image.width,image.height*.8)))
    const height=Math.round(width*1.25)
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height
    const context=canvas.getContext('2d')
    if(!context)throw new Error('Photo processing is unavailable in this browser.')
    context.fillStyle='#f0e9df';context.fillRect(0,0,width,height)
    const scale=Math.min(width/image.width,height/image.height)
    const w=Math.round(image.width*scale),h=Math.round(image.height*scale)
    context.drawImage(image,(width-w)/2,(height-h)/2,w,h)
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Could not prepare this photo.')),'image/webp',.9))
    return new File([blob],file.name.replace(/\.[^.]+$/,'')+'-card.webp',{type:'image/webp'})
  } finally {image.close()}
}
