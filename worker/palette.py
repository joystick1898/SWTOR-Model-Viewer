"""Convert a display RGB swatch to the native palette's offset controls.

SWTOR palette controls are not ordinary HSL: saturation is an inverse exponent,
and brightness offsets texture lightness. Calibrate against the palette map's
median, retaining native contrast, masks and texture variation.
"""
import colorsys
import numpy as np

def palette_offsets(hex_color,pixels,contrast):
    rgb=[int(hex_color[i:i+2],16)/255 for i in (1,3,5)]
    linear=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    hue,light,saturation=colorsys.rgb_to_hls(*linear)
    median=np.median(pixels.reshape(-1,4),axis=0)
    source_h=float(median[1])*(.706-.3137)+.3137-.41176
    source_s=max(.00001,min(.99999,float(median[2])*.5882))
    source_l=max(0,min(1,float(median[3])*.70588))
    lo,hi=0.,1.
    for _ in range(40):
        mid=(lo+hi)/2
        if (1-mid)*source_s**mid>saturation:lo=mid
        else:hi=mid
    base=contrast*source_l**contrast
    brightness=(light-base)/max(1e-6,1-base)
    return ((hue-source_h)%1,(lo+hi)/2,max(-1,min(1,brightness)),contrast)
