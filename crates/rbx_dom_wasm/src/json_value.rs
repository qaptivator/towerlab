//! JSON for Roblox variants, including Infinity and NaN.
//!
//! `serde_json` turns non-finite floats into `null`. Roblox stores those on
//! purpose (`BillboardGui.MaxDistance`, attribute limits), including inside
//! nested values such as `Attributes`. They are kept as the strings
//! `"Infinity"`, `"-Infinity"`, and `"NaN"`.

use serde::Deserialize;
use serde::de::{
    self, DeserializeSeed, Deserializer, EnumAccess, IntoDeserializer, MapAccess, SeqAccess,
    VariantAccess, Visitor,
};
use serde::ser::{
    Serialize, SerializeMap, SerializeSeq, SerializeStruct, SerializeStructVariant, SerializeTuple,
    SerializeTupleStruct, SerializeTupleVariant, Serializer,
};
use serde_json::{Map, Number, Value};

use rbx_types::Variant;

pub fn variant_to_json(value: &Variant) -> Result<Value, serde_json::Error> {
    value.serialize(JsonSer)
}

pub fn variant_from_json(value: &Value) -> Result<Variant, String> {
    Variant::deserialize(Flex(value)).map_err(|error| error.to_string())
}

fn non_finite_token(number: f64) -> &'static str {
    if number.is_nan() {
        "NaN"
    } else if number.is_sign_positive() {
        "Infinity"
    } else {
        "-Infinity"
    }
}

fn parse_non_finite(token: &str) -> Option<f64> {
    match token {
        "Infinity" => Some(f64::INFINITY),
        "-Infinity" => Some(f64::NEG_INFINITY),
        "NaN" => Some(f64::NAN),
        _ => None,
    }
}

struct JsonSer;

impl Serializer for JsonSer {
    type Ok = Value;
    type Error = serde_json::Error;
    type SerializeSeq = JsonSeq;
    type SerializeTuple = JsonSeq;
    type SerializeTupleStruct = JsonSeq;
    type SerializeTupleVariant = JsonWrappedSeq;
    type SerializeMap = JsonMap;
    type SerializeStruct = JsonMap;
    type SerializeStructVariant = JsonWrappedMap;

    fn serialize_bool(self, value: bool) -> Result<Value, Self::Error> {
        Ok(Value::Bool(value))
    }

    fn serialize_i8(self, value: i8) -> Result<Value, Self::Error> {
        Ok(Value::from(value))
    }

    fn serialize_i16(self, value: i16) -> Result<Value, Self::Error> {
        Ok(Value::from(value))
    }

    fn serialize_i32(self, value: i32) -> Result<Value, Self::Error> {
        Ok(Value::from(value))
    }

    fn serialize_i64(self, value: i64) -> Result<Value, Self::Error> {
        Ok(Value::from(value))
    }

    fn serialize_i128(self, value: i128) -> Result<Value, Self::Error> {
        Err(serde::ser::Error::custom(format!("i128 {value} is not a JSON number")))
    }

    fn serialize_u8(self, value: u8) -> Result<Value, Self::Error> {
        Ok(Value::from(value))
    }

    fn serialize_u16(self, value: u16) -> Result<Value, Self::Error> {
        Ok(Value::from(value))
    }

    fn serialize_u32(self, value: u32) -> Result<Value, Self::Error> {
        Ok(Value::from(value))
    }

    fn serialize_u64(self, value: u64) -> Result<Value, Self::Error> {
        Ok(Value::from(value))
    }

    fn serialize_u128(self, value: u128) -> Result<Value, Self::Error> {
        Err(serde::ser::Error::custom(format!("u128 {value} is not a JSON number")))
    }

    fn serialize_f32(self, value: f32) -> Result<Value, Self::Error> {
        self.serialize_f64(f64::from(value))
    }

    fn serialize_f64(self, value: f64) -> Result<Value, Self::Error> {
        if let Some(number) = Number::from_f64(value) {
            Ok(Value::Number(number))
        } else {
            Ok(Value::String(non_finite_token(value).to_owned()))
        }
    }

    fn serialize_char(self, value: char) -> Result<Value, Self::Error> {
        Ok(Value::String(value.to_string()))
    }

    fn serialize_str(self, value: &str) -> Result<Value, Self::Error> {
        Ok(Value::String(value.to_owned()))
    }

    fn serialize_bytes(self, value: &[u8]) -> Result<Value, Self::Error> {
        Ok(Value::Array(value.iter().copied().map(Value::from).collect()))
    }

    fn serialize_none(self) -> Result<Value, Self::Error> {
        Ok(Value::Null)
    }

    fn serialize_some<T: Serialize + ?Sized>(self, value: &T) -> Result<Value, Self::Error> {
        value.serialize(self)
    }

    fn serialize_unit(self) -> Result<Value, Self::Error> {
        Ok(Value::Null)
    }

    fn serialize_unit_struct(self, _name: &'static str) -> Result<Value, Self::Error> {
        Ok(Value::Null)
    }

    fn serialize_unit_variant(
        self,
        _name: &'static str,
        _index: u32,
        variant: &'static str,
    ) -> Result<Value, Self::Error> {
        Ok(Value::String(variant.to_owned()))
    }

    fn serialize_newtype_struct<T: Serialize + ?Sized>(
        self,
        _name: &'static str,
        value: &T,
    ) -> Result<Value, Self::Error> {
        value.serialize(self)
    }

    fn serialize_newtype_variant<T: Serialize + ?Sized>(
        self,
        _name: &'static str,
        _index: u32,
        variant: &'static str,
        value: &T,
    ) -> Result<Value, Self::Error> {
        let mut map = Map::new();
        map.insert(variant.to_owned(), value.serialize(JsonSer)?);
        Ok(Value::Object(map))
    }

    fn serialize_seq(self, len: Option<usize>) -> Result<JsonSeq, Self::Error> {
        Ok(JsonSeq {
            items: Vec::with_capacity(len.unwrap_or(0)),
        })
    }

    fn serialize_tuple(self, len: usize) -> Result<JsonSeq, Self::Error> {
        self.serialize_seq(Some(len))
    }

    fn serialize_tuple_struct(self, _name: &'static str, len: usize) -> Result<JsonSeq, Self::Error> {
        self.serialize_seq(Some(len))
    }

    fn serialize_tuple_variant(
        self,
        _name: &'static str,
        _index: u32,
        variant: &'static str,
        len: usize,
    ) -> Result<JsonWrappedSeq, Self::Error> {
        Ok(JsonWrappedSeq {
            name: variant,
            items: Vec::with_capacity(len),
        })
    }

    fn serialize_map(self, len: Option<usize>) -> Result<JsonMap, Self::Error> {
        Ok(JsonMap {
            map: Map::with_capacity(len.unwrap_or(0)),
            next_key: None,
        })
    }

    fn serialize_struct(self, _name: &'static str, len: usize) -> Result<JsonMap, Self::Error> {
        self.serialize_map(Some(len))
    }

    fn serialize_struct_variant(
        self,
        _name: &'static str,
        _index: u32,
        variant: &'static str,
        len: usize,
    ) -> Result<JsonWrappedMap, Self::Error> {
        Ok(JsonWrappedMap {
            name: variant,
            map: JsonMap {
                map: Map::with_capacity(len),
                next_key: None,
            },
        })
    }
}

struct JsonSeq {
    items: Vec<Value>,
}

impl SerializeSeq for JsonSeq {
    type Ok = Value;
    type Error = serde_json::Error;

    fn serialize_element<T: Serialize + ?Sized>(&mut self, value: &T) -> Result<(), Self::Error> {
        self.items.push(value.serialize(JsonSer)?);
        Ok(())
    }

    fn end(self) -> Result<Value, Self::Error> {
        Ok(Value::Array(self.items))
    }
}

impl SerializeTuple for JsonSeq {
    type Ok = Value;
    type Error = serde_json::Error;

    fn serialize_element<T: Serialize + ?Sized>(&mut self, value: &T) -> Result<(), Self::Error> {
        SerializeSeq::serialize_element(self, value)
    }

    fn end(self) -> Result<Value, Self::Error> {
        SerializeSeq::end(self)
    }
}

impl SerializeTupleStruct for JsonSeq {
    type Ok = Value;
    type Error = serde_json::Error;

    fn serialize_field<T: Serialize + ?Sized>(&mut self, value: &T) -> Result<(), Self::Error> {
        SerializeSeq::serialize_element(self, value)
    }

    fn end(self) -> Result<Value, Self::Error> {
        SerializeSeq::end(self)
    }
}

struct JsonWrappedSeq {
    name: &'static str,
    items: Vec<Value>,
}

impl SerializeTupleVariant for JsonWrappedSeq {
    type Ok = Value;
    type Error = serde_json::Error;

    fn serialize_field<T: Serialize + ?Sized>(&mut self, value: &T) -> Result<(), Self::Error> {
        self.items.push(value.serialize(JsonSer)?);
        Ok(())
    }

    fn end(self) -> Result<Value, Self::Error> {
        let mut map = Map::new();
        map.insert(self.name.to_owned(), Value::Array(self.items));
        Ok(Value::Object(map))
    }
}

struct JsonMap {
    map: Map<String, Value>,
    next_key: Option<String>,
}

impl SerializeMap for JsonMap {
    type Ok = Value;
    type Error = serde_json::Error;

    fn serialize_key<T: Serialize + ?Sized>(&mut self, key: &T) -> Result<(), Self::Error> {
        match key.serialize(JsonSer)? {
            Value::String(key) => {
                self.next_key = Some(key);
                Ok(())
            }
            _ => Err(serde::ser::Error::custom("map key must be a string")),
        }
    }

    fn serialize_value<T: Serialize + ?Sized>(&mut self, value: &T) -> Result<(), Self::Error> {
        let key = self
            .next_key
            .take()
            .ok_or_else(|| serde::ser::Error::custom("missing map key"))?;
        self.map.insert(key, value.serialize(JsonSer)?);
        Ok(())
    }

    fn end(self) -> Result<Value, Self::Error> {
        Ok(Value::Object(self.map))
    }
}

impl SerializeStruct for JsonMap {
    type Ok = Value;
    type Error = serde_json::Error;

    fn serialize_field<T: Serialize + ?Sized>(
        &mut self,
        key: &'static str,
        value: &T,
    ) -> Result<(), Self::Error> {
        self.map.insert(key.to_owned(), value.serialize(JsonSer)?);
        Ok(())
    }

    fn end(self) -> Result<Value, Self::Error> {
        Ok(Value::Object(self.map))
    }
}

struct JsonWrappedMap {
    name: &'static str,
    map: JsonMap,
}

impl SerializeStructVariant for JsonWrappedMap {
    type Ok = Value;
    type Error = serde_json::Error;

    fn serialize_field<T: Serialize + ?Sized>(
        &mut self,
        key: &'static str,
        value: &T,
    ) -> Result<(), Self::Error> {
        SerializeStruct::serialize_field(&mut self.map, key, value)
    }

    fn end(self) -> Result<Value, Self::Error> {
        let mut map = Map::new();
        map.insert(self.name.to_owned(), SerializeStruct::end(self.map)?);
        Ok(Value::Object(map))
    }
}

struct Flex<'a>(&'a Value);

impl<'de> Deserializer<'de> for Flex<'de> {
    type Error = serde_json::Error;

    fn deserialize_any<V: Visitor<'de>>(self, visitor: V) -> Result<V::Value, Self::Error> {
        match self.0 {
            Value::Array(items) => visitor.visit_seq(FlexSeq { iter: items.iter() }),
            Value::Object(map) => visitor.visit_map(FlexMap {
                iter: map.iter(),
                value: None,
            }),
            other => other.deserialize_any(visitor),
        }
    }

    fn deserialize_f32<V: Visitor<'de>>(self, visitor: V) -> Result<V::Value, Self::Error> {
        if let Some(number) = self.0.as_str().and_then(parse_non_finite) {
            return visitor.visit_f32(number as f32);
        }
        self.0.deserialize_f32(visitor)
    }

    fn deserialize_f64<V: Visitor<'de>>(self, visitor: V) -> Result<V::Value, Self::Error> {
        if let Some(number) = self.0.as_str().and_then(parse_non_finite) {
            return visitor.visit_f64(number);
        }
        self.0.deserialize_f64(visitor)
    }

    fn deserialize_option<V: Visitor<'de>>(self, visitor: V) -> Result<V::Value, Self::Error> {
        match self.0 {
            Value::Null => visitor.visit_none(),
            _ => visitor.visit_some(Flex(self.0)),
        }
    }

    fn deserialize_enum<V: Visitor<'de>>(
        self,
        name: &'static str,
        variants: &'static [&'static str],
        visitor: V,
    ) -> Result<V::Value, Self::Error> {
        match self.0 {
            Value::Object(map) => {
                let mut iter = map.iter();
                let Some((variant, value)) = iter.next() else {
                    return Err(de::Error::invalid_value(
                        de::Unexpected::Map,
                        &"map with a single key",
                    ));
                };
                if iter.next().is_some() {
                    return Err(de::Error::invalid_value(
                        de::Unexpected::Map,
                        &"map with a single key",
                    ));
                }
                visitor.visit_enum(FlexEnum { variant, value })
            }
            Value::String(variant) => visitor.visit_enum(FlexUnit { variant }),
            other => other.deserialize_enum(name, variants, visitor),
        }
    }

    fn deserialize_newtype_struct<V: Visitor<'de>>(
        self,
        _name: &'static str,
        visitor: V,
    ) -> Result<V::Value, Self::Error> {
        visitor.visit_newtype_struct(self)
    }

    serde::forward_to_deserialize_any! {
        bool i8 i16 i32 i64 i128 u8 u16 u32 u64 u128 char str string
        bytes byte_buf unit unit_struct seq tuple tuple_struct map struct
        identifier ignored_any
    }
}

struct FlexSeq<'a> {
    iter: std::slice::Iter<'a, Value>,
}

impl<'de> SeqAccess<'de> for FlexSeq<'de> {
    type Error = serde_json::Error;

    fn next_element_seed<T: DeserializeSeed<'de>>(
        &mut self,
        seed: T,
    ) -> Result<Option<T::Value>, Self::Error> {
        match self.iter.next() {
            Some(value) => seed.deserialize(Flex(value)).map(Some),
            None => Ok(None),
        }
    }
}

struct FlexMap<'a> {
    iter: serde_json::map::Iter<'a>,
    value: Option<&'a Value>,
}

impl<'de> MapAccess<'de> for FlexMap<'de> {
    type Error = serde_json::Error;

    fn next_key_seed<T: DeserializeSeed<'de>>(
        &mut self,
        seed: T,
    ) -> Result<Option<T::Value>, Self::Error> {
        match self.iter.next() {
            Some((key, value)) => {
                self.value = Some(value);
                seed.deserialize(key.as_str().into_deserializer()).map(Some)
            }
            None => Ok(None),
        }
    }

    fn next_value_seed<T: DeserializeSeed<'de>>(
        &mut self,
        seed: T,
    ) -> Result<T::Value, Self::Error> {
        let value = self
            .value
            .take()
            .ok_or_else(|| de::Error::custom("missing map value"))?;
        seed.deserialize(Flex(value))
    }
}

struct FlexUnit<'a> {
    variant: &'a str,
}

impl<'de> EnumAccess<'de> for FlexUnit<'de> {
    type Error = serde_json::Error;
    type Variant = FlexVariant<'de>;

    fn variant_seed<V: DeserializeSeed<'de>>(
        self,
        seed: V,
    ) -> Result<(V::Value, Self::Variant), Self::Error> {
        let variant = seed.deserialize(self.variant.into_deserializer())?;
        Ok((variant, FlexVariant { value: None }))
    }
}

struct FlexEnum<'a> {
    variant: &'a str,
    value: &'a Value,
}

impl<'de> EnumAccess<'de> for FlexEnum<'de> {
    type Error = serde_json::Error;
    type Variant = FlexVariant<'de>;

    fn variant_seed<V: DeserializeSeed<'de>>(
        self,
        seed: V,
    ) -> Result<(V::Value, Self::Variant), Self::Error> {
        let variant = seed.deserialize(self.variant.into_deserializer())?;
        Ok((
            variant,
            FlexVariant {
                value: Some(self.value),
            },
        ))
    }
}

struct FlexVariant<'a> {
    value: Option<&'a Value>,
}

impl<'de> VariantAccess<'de> for FlexVariant<'de> {
    type Error = serde_json::Error;

    fn unit_variant(self) -> Result<(), Self::Error> {
        Ok(())
    }

    fn newtype_variant_seed<T: DeserializeSeed<'de>>(
        self,
        seed: T,
    ) -> Result<T::Value, Self::Error> {
        let value = self
            .value
            .ok_or_else(|| de::Error::custom("missing variant value"))?;
        seed.deserialize(Flex(value))
    }

    fn tuple_variant<V: Visitor<'de>>(self, _len: usize, visitor: V) -> Result<V::Value, Self::Error> {
        let value = self
            .value
            .ok_or_else(|| de::Error::custom("missing variant value"))?;
        match value {
            Value::Array(items) => visitor.visit_seq(FlexSeq { iter: items.iter() }),
            _ => Err(de::Error::custom("tuple variant must be an array")),
        }
    }

    fn struct_variant<V: Visitor<'de>>(
        self,
        _fields: &'static [&'static str],
        visitor: V,
    ) -> Result<V::Value, Self::Error> {
        let value = self
            .value
            .ok_or_else(|| de::Error::custom("missing variant value"))?;
        match value {
            Value::Object(map) => visitor.visit_map(FlexMap {
                iter: map.iter(),
                value: None,
            }),
            _ => Err(de::Error::custom("struct variant must be an object")),
        }
    }
}
