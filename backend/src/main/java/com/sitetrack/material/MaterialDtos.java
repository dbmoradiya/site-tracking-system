package com.sitetrack.material;

import java.math.BigDecimal;
import java.util.List;

public final class MaterialDtos {
    private MaterialDtos() {}
    public record Item(String material, String uom, BigDecimal qty, BigDecimal rate, BigDecimal gst) {}
    public record VendorIn(String name, String mobile, String gst, String address) {}
    public record PurchaseIn(String date, String vendor, String vendorMobile, String vendorGst, String vendorAddress,
                             String billNumber, Boolean removeInvoice, List<Item> items) {}
    public record SaleIn(String type, String date, String vendor, VendorIn newVendor, List<Long> siteIds, List<Item> items, List<GroupLineIn> groups) {}
    public record GroupChildIn(String material, BigDecimal rate, BigDecimal gst) {}
    public record GroupLineIn(Long groupId, BigDecimal qty, List<GroupChildIn> children) {}
    public record GroupItemIn(String material, BigDecimal qty) {}
    public record GroupIn(String name, List<GroupItemIn> items) {}
    public record MaterialTypeIn(String name, String uom, String hsn) {}
    public record CompanyIn(String name, String address, String gst, String mobile) {}
}
