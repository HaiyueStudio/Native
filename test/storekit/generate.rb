require 'xcodeproj'
require 'fileutils'
source = File.expand_path(__dir__)
output = File.expand_path(ARGV.fetch(0))
FileUtils.mkdir_p(output)
project = Xcodeproj::Project.new(File.join(output, 'NativeStoreTests.xcodeproj'))
host = project.new_target(:application, 'NativeStoreTestHost', :ios, '17.0')
tests = project.new_target(:unit_test_bundle, 'NativeStoreTests', :ios, '17.0')
[host, tests].each do |target|
  target.build_configurations.each do |config|
    config.build_settings.merge!({
      'SWIFT_VERSION' => '5.0', 'GENERATE_INFOPLIST_FILE' => 'YES',
      'CODE_SIGNING_ALLOWED' => 'YES', 'CODE_SIGN_IDENTITY' => '-', 'TARGETED_DEVICE_FAMILY' => '1,2',
      'PRODUCT_BUNDLE_IDENTIFIER' => "org.haiyue.tests.#{target.name}",
      'IPHONEOS_DEPLOYMENT_TARGET' => '17.0'
    })
  end
end
host.build_configurations.each { |c| c.build_settings['CODE_SIGN_ENTITLEMENTS'] = File.join(source, 'Host.entitlements') }
host.source_build_phase.add_file_reference(project.main_group.new_file(File.join(source, 'Host.swift')))
tests.add_dependency(host)
tests.build_configurations.each do |config|
  config.build_settings['TEST_HOST'] = '$(BUILT_PRODUCTS_DIR)/NativeStoreTestHost.app/NativeStoreTestHost'
  config.build_settings['BUNDLE_LOADER'] = '$(TEST_HOST)'
  config.build_settings['LD_RUNPATH_SEARCH_PATHS'] = ['$(inherited)', '@executable_path/Frameworks', '@loader_path/Frameworks']
end
['NativeStoreTests.swift', '../../bridge/purchases/native/ios/HYNonConsumableStore.swift'].each do |file|
  tests.source_build_phase.add_file_reference(project.main_group.new_file(File.expand_path(file, source)))
end
tests.resources_build_phase.add_file_reference(project.main_group.new_file(File.join(source, 'Native.storekit')))
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(host)
scheme.add_build_target(tests)
scheme.set_launch_target(host)
scheme.add_test_target(tests)
scheme.test_action.build_configuration = 'Debug'
scheme.save_as(project.path, 'NativeStoreTests', true)
puts project.path
