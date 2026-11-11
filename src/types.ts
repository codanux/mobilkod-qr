export type ModifierOption = { id: string; name: string; delta: number; abs: number | null };
export type ModifierGroup = { id: string; name: string; min: number; max: number; options: ModifierOption[] };
export type MenuSlot = { id: string; name: string; required: boolean; options: { id: string; productId: string; name: string; upcharge: number; soldOut: boolean }[] };
export type Product = { id: string; name: string; description?: string; imageUrl?: string; price: number; soldOut: boolean; isMenu?: boolean; groups: ModifierGroup[]; slots?: MenuSlot[] };
export type MenuCategory = { id: string; name: string; products: Product[] };
export type VenueType = "RESTAURANT" | "MARKET";

export type MenuResponse = {
  tenantId: string; shop: string; address: string; phone: string; table: string | null;
  venueType: VenueType;
  isTableQr: boolean; dineInEnabled: boolean; deliveryEnabled: boolean;
  deliveryAcceptingOrders?: boolean; deliveryFee: number; deliveryPerKm: number | null;
  deliveryMinimumOrder: number; deliveryOriginLatitude: number | null; deliveryOriginLongitude: number | null;
  categories: MenuCategory[];
};
export type Restaurant = {
  id: string; name: string; address: string; phone: string; venueType: VenueType; dineInEnabled: boolean;
  deliveryEnabled: boolean; deliveryAcceptingOrders?: boolean; deliveryFee: number;
  deliveryPerKm: number | null; deliveryMinimumOrder: number;
  deliveryOriginLatitude: number | null; deliveryOriginLongitude: number | null;
};
export type CartLine = { key: string; product: Product; quantity: number; note: string; modifierIds: string[]; menuOptionIds: string[]; choiceNames: string[]; unitPrice: number };
export type ContactAddress = { id: string | null; label: string; address: string; latitude?: number | null; longitude?: number | null; isDefault: boolean };
export type ContactProfile = { name: string; phone: string; address: string; addresses: ContactAddress[]; shareWithRestaurant: boolean };
export type CustomerOrder = {
  id: string;
  items: { productId: string; productName?: string; choiceNames?: string[]; quantity: number; unitPrice?: number; note?: string; modifierIds?: string[]; menuOptionIds?: string[] }[];
  orderType: "DINE_IN" | "DELIVERY";
  status: "PENDING" | "CLAIMED" | "RECEIVED" | "FEE_CONFIRMATION" | "FEE_ACCEPTED" | "FEE_CANCELLED" | "APPROVED" | "REJECTED" | "PAID";
  tenantId: string; sessionId: string; localNumber: number | null; amount: number | null;
  subtotal: number | null; discount: number | null; deliveryFee: number | null;
  estimatedDeliveryFee: number | null; deliveryDistanceKm: number | null;
  paymentDetails: { method: string; amount: number; provider?: string | null; paidAt: string }[] | null;
  claimedAt: string | null; receivedAt: string | null; decidedAt: string | null;
  paidAt: string | null; reason: string | null; createdAt: string;
  restaurantName?: string; tableName?: string | null;
};
