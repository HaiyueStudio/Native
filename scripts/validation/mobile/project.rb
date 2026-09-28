require 'xcodeproj'
base=File.expand_path(__dir__)
p=Xcodeproj::Project.new(File.join(base,'Acceptance.xcodeproj'))
t=p.new_target(:ui_test_bundle,'Acceptance',:ios,'15.0')
t.add_file_references([p.main_group.new_file('Acceptance.swift')])
t.build_configurations.each do |c|
 c.build_settings.merge!({'PRODUCT_BUNDLE_IDENTIFIER'=>'org.haiyue.nativevalidation.acceptance','DEVELOPMENT_TEAM'=>ENV.fetch('IOS_TEAM_ID'),'CODE_SIGN_STYLE'=>'Automatic','GENERATE_INFOPLIST_FILE'=>'YES','SWIFT_VERSION'=>'5.0','TARGETED_DEVICE_FAMILY'=>'1,2'})
end
p.save
s=Xcodeproj::XCScheme.new
s.add_build_target(t)
s.add_test_target(t)
s.save_as(p.path,'Acceptance',true)
