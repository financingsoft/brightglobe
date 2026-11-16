-- Behavioral tests for the Marketplace V1 source schema.
-- Run only after the draft migration and static assertions on disposable PostgreSQL.
DO $behavior$
DECLARE
  v_slug_rejected boolean := false;
  v_duplicate_review_rejected boolean := false;
  v_review_content_immutable boolean := false;
  v_category_limit_rejected boolean := false;
  v_second_locale_publish_rejected boolean := false;
  v_non_android_artifact_rejected boolean := false;
  v_version_withdrawal_rejected boolean := false;
  v_audit_mutation_rejected boolean := false;
  v_duplicate_tags_rejected boolean := false;
BEGIN
  INSERT INTO public.canonical_users(id) VALUES
    ('00000000-0000-4000-8000-000000000001'),
    ('00000000-0000-4000-8000-000000000002')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO marketplace.developers(
    id, slug, display_name, status, created_by_canonical_user_id
  ) VALUES (
    '10000000-0000-4000-8000-000000000001',
    'ci-publisher',
    'CI Publisher',
    'pending',
    '00000000-0000-4000-8000-000000000001'
  );

  INSERT INTO marketplace.developer_memberships(
    developer_id, canonical_user_id, "role", status, created_by_canonical_user_id
  ) VALUES (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    'owner',
    'active',
    '00000000-0000-4000-8000-000000000001'
  );

  UPDATE marketplace.developers
  SET status = 'active', verification_status = 'verified'
  WHERE id = '10000000-0000-4000-8000-000000000001';

  INSERT INTO marketplace.categories(id, slug, status, sort_order) VALUES
    ('20000000-0000-4000-8000-000000000001', 'ci-productivity', 'active', 1),
    ('20000000-0000-4000-8000-000000000002', 'ci-tools', 'active', 2),
    ('20000000-0000-4000-8000-000000000003', 'ci-business', 'active', 3),
    ('20000000-0000-4000-8000-000000000004', 'ci-extra', 'active', 4);

  INSERT INTO marketplace.category_localizations(category_id, locale, name) VALUES
    ('20000000-0000-4000-8000-000000000001', 'en-US', 'Productivity'),
    ('20000000-0000-4000-8000-000000000002', 'en-US', 'Tools'),
    ('20000000-0000-4000-8000-000000000003', 'en-US', 'Business'),
    ('20000000-0000-4000-8000-000000000004', 'en-US', 'Extra');

  INSERT INTO marketplace.apps(
    id, developer_id, slug, app_type, status, created_by_canonical_user_id
  ) VALUES (
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'ci-app',
    'app',
    'draft',
    '00000000-0000-4000-8000-000000000001'
  );

  INSERT INTO marketplace.app_listing_revisions(
    id, app_id, revision_number, content_locale, name, description, metadata_checksum
  ) VALUES (
    '40000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    1,
    'en-US',
    'CI App',
    'Marketplace schema test app',
    repeat('a', 64)
  );

  INSERT INTO marketplace.app_listing_revision_categories(revision_id, category_id)
  VALUES (
    '40000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001'
  );

  INSERT INTO marketplace.app_listing_platform_targets(id, revision_id, platform)
  VALUES (
    '41000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    'android'
  );

  UPDATE marketplace.app_listing_revisions
  SET status = 'approved', reviewed_by_canonical_user_id = '00000000-0000-4000-8000-000000000002',
      reviewed_at = now()
  WHERE id = '40000000-0000-4000-8000-000000000001';

  UPDATE marketplace.app_listing_revisions
  SET status = 'published', published_at = now()
  WHERE id = '40000000-0000-4000-8000-000000000001';

  UPDATE marketplace.apps SET status = 'published'
  WHERE id = '30000000-0000-4000-8000-000000000001';

  BEGIN
    UPDATE marketplace.apps SET slug = 'ci-app-renamed'
    WHERE id = '30000000-0000-4000-8000-000000000001';
  EXCEPTION WHEN check_violation THEN
    v_slug_rejected := true;
  END;
  IF NOT v_slug_rejected THEN
    RAISE EXCEPTION 'published app slug mutation was not rejected';
  END IF;

  INSERT INTO marketplace.reviews(id, app_id, canonical_user_id, status)
  VALUES (
    '50000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    'pending'
  );

  INSERT INTO marketplace.review_revisions(
    id, review_id, revision_number, rating, body, created_by_canonical_user_id
  ) VALUES (
    '51000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    1,
    5,
    'Initial review',
    '00000000-0000-4000-8000-000000000001'
  );

  UPDATE marketplace.reviews
  SET pending_revision_id = '51000000-0000-4000-8000-000000000001'
  WHERE id = '50000000-0000-4000-8000-000000000001';

  UPDATE marketplace.review_revisions SET moderation_status = 'approved',
    reviewed_by_canonical_user_id = '00000000-0000-4000-8000-000000000002',
    reviewed_at = now()
  WHERE id = '51000000-0000-4000-8000-000000000001';

  UPDATE marketplace.reviews
  SET status = 'published',
      published_revision_id = '51000000-0000-4000-8000-000000000001',
      pending_revision_id = NULL,
      published_at = now()
  WHERE id = '50000000-0000-4000-8000-000000000001';

  BEGIN
    INSERT INTO marketplace.reviews(id, app_id, canonical_user_id, status)
    VALUES (
      '50000000-0000-4000-8000-000000000002',
      '30000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000001',
      'pending'
    );
  EXCEPTION WHEN unique_violation THEN
    v_duplicate_review_rejected := true;
  END;
  IF NOT v_duplicate_review_rejected THEN
    RAISE EXCEPTION 'duplicate active review was not rejected';
  END IF;

  INSERT INTO marketplace.review_revisions(
    id, review_id, revision_number, rating, body, created_by_canonical_user_id
  ) VALUES (
    '51000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000001',
    2,
    4,
    'Edited review pending moderation',
    '00000000-0000-4000-8000-000000000001'
  );
  UPDATE marketplace.reviews
  SET pending_revision_id = '51000000-0000-4000-8000-000000000002'
  WHERE id = '50000000-0000-4000-8000-000000000001';
  IF (SELECT published_revision_id FROM marketplace.reviews
      WHERE id = '50000000-0000-4000-8000-000000000001')
     <> '51000000-0000-4000-8000-000000000001'::uuid THEN
    RAISE EXCEPTION 'pending review edit replaced the currently published revision';
  END IF;

  BEGIN
    UPDATE marketplace.review_revisions SET body = 'tampered'
    WHERE id = '51000000-0000-4000-8000-000000000001';
  EXCEPTION WHEN check_violation THEN
    v_review_content_immutable := true;
  END;
  IF NOT v_review_content_immutable THEN
    RAISE EXCEPTION 'published review revision content mutation was not rejected';
  END IF;

  INSERT INTO marketplace.app_listing_revisions(
    id, app_id, revision_number, content_locale, name, description, metadata_checksum
  ) VALUES (
    '40000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000001',
    2,
    'en-US',
    'CI App second revision',
    'Second locale-specific revision for category guard test',
    repeat('b', 64)
  );

  INSERT INTO marketplace.app_listing_revision_categories(revision_id, category_id) VALUES
    ('40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001'),
    ('40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002'),
    ('40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003');

  BEGIN
    INSERT INTO marketplace.app_listing_revision_categories(revision_id, category_id)
    VALUES ('40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000004');
  EXCEPTION WHEN check_violation THEN
    v_category_limit_rejected := true;
  END;
  IF NOT v_category_limit_rejected THEN
    RAISE EXCEPTION 'fourth category assignment was not rejected';
  END IF;

  INSERT INTO marketplace.app_listing_platform_targets(id, revision_id, platform)
  VALUES (
    '41000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000002',
    'android'
  );

  UPDATE marketplace.app_listing_revisions SET status = 'approved',
    reviewed_by_canonical_user_id = '00000000-0000-4000-8000-000000000002',
    reviewed_at = now()
  WHERE id = '40000000-0000-4000-8000-000000000002';

  BEGIN
    UPDATE marketplace.app_listing_revisions SET status = 'published', published_at = now()
    WHERE id = '40000000-0000-4000-8000-000000000002';
  EXCEPTION WHEN unique_violation THEN
    v_second_locale_publish_rejected := true;
  END;
  IF NOT v_second_locale_publish_rejected THEN
    RAISE EXCEPTION 'two published revisions for one app locale were allowed';
  END IF;

  INSERT INTO marketplace.app_versions(
    id, app_id, platform, version_name, status, created_by_canonical_user_id
  ) VALUES
    ('60000000-0000-4000-8000-000000000001',
     '30000000-0000-4000-8000-000000000001',
     'android', '1.0.0', 'draft',
     '00000000-0000-4000-8000-000000000001'),
    ('60000000-0000-4000-8000-000000000002',
     '30000000-0000-4000-8000-000000000001',
     'ios', '1.0.0', 'draft',
     '00000000-0000-4000-8000-000000000001');

  INSERT INTO marketplace.app_artifacts(
    id, app_version_id, artifact_format, storage_object_version_id, sha256,
    size_bytes, detected_mime, package_identifier, signer_fingerprint
  ) VALUES (
    '70000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    'apk',
    '71000000-0000-4000-8000-000000000001',
    repeat('a', 64),
    1024,
    'application/vnd.android.package-archive',
    'com.example.ciapp',
    'ci-test-signer'
  );

  BEGIN
    INSERT INTO marketplace.app_artifacts(
      id, app_version_id, artifact_format, storage_object_version_id, sha256,
      size_bytes, detected_mime, package_identifier, signer_fingerprint
    ) VALUES (
      '70000000-0000-4000-8000-000000000002',
      '60000000-0000-4000-8000-000000000002',
      'apk',
      '71000000-0000-4000-8000-000000000002',
      repeat('b', 64),
      1024,
      'application/vnd.android.package-archive',
      'com.example.ciapp',
      'ci-test-signer'
    );
  EXCEPTION WHEN check_violation THEN
    v_non_android_artifact_rejected := true;
  END;
  IF NOT v_non_android_artifact_rejected THEN
    RAISE EXCEPTION 'non-Android hosted artifact was not rejected';
  END IF;

  UPDATE marketplace.app_artifacts
  SET scan_status = 'clean', approval_status = 'approved'
  WHERE id = '70000000-0000-4000-8000-000000000001';

  UPDATE marketplace.app_versions SET status = 'approved'
  WHERE id = '60000000-0000-4000-8000-000000000001';

  INSERT INTO marketplace.distribution_sources(
    id, app_version_id, source_type, artifact_id
  ) VALUES (
    '80000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    'globe_hosted_verified',
    '70000000-0000-4000-8000-000000000001'
  );

  UPDATE marketplace.distribution_sources
  SET status = 'active',
      verification_status = 'verified',
      approved_by_canonical_user_id = '00000000-0000-4000-8000-000000000001',
      approved_at = now()
  WHERE id = '80000000-0000-4000-8000-000000000001';

  BEGIN
    UPDATE marketplace.app_versions SET status = 'withdrawn'
    WHERE id = '60000000-0000-4000-8000-000000000001';
  EXCEPTION WHEN check_violation THEN
    v_version_withdrawal_rejected := true;
  END;
  IF NOT v_version_withdrawal_rejected THEN
    RAISE EXCEPTION 'active distribution source did not protect approved version state';
  END IF;

  INSERT INTO marketplace.audit_events(
    id, actor_canonical_user_id, actor_type, action, target_type, target_id, correlation_id
  ) VALUES (
    '90000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    'user',
    'ci.schema.test',
    'app',
    '30000000-0000-4000-8000-000000000001',
    'ci-marketplace-schema'
  );

  BEGIN
    UPDATE marketplace.audit_events SET metadata = '{"tampered":true}'::jsonb
    WHERE id = '90000000-0000-4000-8000-000000000001';
  EXCEPTION WHEN check_violation THEN
    v_audit_mutation_rejected := true;
  END;
  IF NOT v_audit_mutation_rejected THEN
    RAISE EXCEPTION 'audit event mutation was not rejected';
  END IF;

  INSERT INTO marketplace.domain_outbox(
    event_id, event_type, schema_version, aggregate_type, aggregate_id,
    aggregate_version, payload, invalidation_tags, occurred_at
  ) VALUES (
    'a0000000-0000-4000-8000-000000000001',
    'app.projection.upsert.v1',
    1,
    'app',
    '30000000-0000-4000-8000-000000000001',
    1,
    '{"appId":"30000000-0000-4000-8000-000000000001"}'::jsonb,
    ARRAY['app:30000000-0000-4000-8000-000000000001','developer:10000000-0000-4000-8000-000000000001'],
    now()
  );

  BEGIN
    INSERT INTO marketplace.domain_outbox(
      event_id, event_type, schema_version, aggregate_type, aggregate_id,
      aggregate_version, payload, invalidation_tags, occurred_at
    ) VALUES (
      'a0000000-0000-4000-8000-000000000002',
      'app.projection.upsert.v1',
      1,
      'app',
      '30000000-0000-4000-8000-000000000001',
      2,
      '{}'::jsonb,
      ARRAY['app:duplicate','app:duplicate'],
      now()
    );
  EXCEPTION WHEN check_violation THEN
    v_duplicate_tags_rejected := true;
  END;
  IF NOT v_duplicate_tags_rejected THEN
    RAISE EXCEPTION 'duplicate outbox invalidation tags were not rejected';
  END IF;

  RAISE NOTICE 'Marketplace V1 behavioral assertions passed.';
END
$behavior$;
