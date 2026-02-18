-- Create user_addresses table for storing delivery addresses

CREATE TABLE IF NOT EXISTS user_addresses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  label VARCHAR(100) NOT NULL COMMENT 'Address label like Home, Office, etc.',
  street TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  zip_code VARCHAR(20) NOT NULL,
  country VARCHAR(100) DEFAULT 'India',
  phone VARCHAR(20) NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_is_default (is_default)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add phone field to users table if it doesn't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS phone VARCHAR(20) DEFAULT NULL AFTER email;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_addresses_user_default 
ON user_addresses(user_id, is_default);

-- Trigger to ensure only one default address per user
DELIMITER $$

CREATE TRIGGER before_user_address_insert 
BEFORE INSERT ON user_addresses
FOR EACH ROW
BEGIN
  IF NEW.is_default = TRUE THEN
    UPDATE user_addresses 
    SET is_default = FALSE 
    WHERE user_id = NEW.user_id;
  END IF;
END$$

CREATE TRIGGER before_user_address_update 
BEFORE UPDATE ON user_addresses
FOR EACH ROW
BEGIN
  IF NEW.is_default = TRUE AND NEW.is_default != OLD.is_default THEN
    UPDATE user_addresses 
    SET is_default = FALSE 
    WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;
END$$

DELIMITER ;
